import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareReports } from "../compare/index.ts";
import type { AuditReport } from "../contract/index.ts";
import { discoverSourceInventory } from "../discovery/index.ts";
import { auditWorkspace } from "./audit.ts";
import { runWorkspaceAudit } from "./run.ts";

const FIXTURE_ROOT = join(import.meta.dir, "../../corpus/fixtures");
const NOW = new Date("2026-01-01T00:00:00.000Z");

interface LanguageCoverageRow {
	language: "typescript" | "python";
	discoveredFiles: number;
	analyzedFiles: number;
	parseFailureFiles: number;
	sloc: number;
	unresolvedImports: number;
	dynamicImports: number;
}

function languageCoverage(report: AuditReport): LanguageCoverageRow[] {
	const rows = (report as AuditReport & { languageCoverage?: unknown }).languageCoverage;
	if (!Array.isArray(rows)) throw new Error("report is missing language coverage");
	return rows as LanguageCoverageRow[];
}

function identityOf(finding: AuditReport["findings"][number]) {
	return "identity" in finding ? finding.identity : undefined;
}

function hasClassScope(finding: AuditReport["findings"][number], name: string): boolean {
	const identity = identityOf(finding);
	return identity?.state === "identified" && identity.scopes.some((scope) => scope.name === name);
}

async function fixtureCopy(name: "python-project" | "mixed-project"): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), `trellis-${name}-`));
	await cp(join(FIXTURE_ROOT, name), root, { recursive: true });
	roots.push(root);
	return root;
}

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Python discovery and normalized audit acceptance", () => {
	test("discovers Python production and test files while excluding environments and builds", async () => {
		const root = await fixtureCopy("python-project");
		await mkdir(join(root, "dist"));
		await writeFile(join(root, "dist/generated.py"), "generated = True\n");
		const inventory = await discoverSourceInventory(root);
		const paths = inventory.files.map((file) => file.path);

		expect(paths.some((path) => path.endsWith("complexity.py"))).toBe(true);
		expect(paths).toContain("tests/test_app.py");
		expect(inventory.files.filter((file) => file.language === "python")).toHaveLength(9);
		expect(paths.some((path) => path.includes(".venv/") || path.includes("__pycache__/"))).toBe(
			false,
		);
		expect(inventory.ignored.map((entry) => entry.path)).toEqual(
			expect.arrayContaining([".venv", "venv", "__pycache__", ".pytest_cache"]),
		);
		expect(inventory.excluded.map((entry) => entry.path)).toContain("dist/generated.py");
		expect(inventory.unsupported.byExtension[".py"]).toBeUndefined();
	});

	test("reports Python complexity, erosion, normalized duplication and an actual relative cycle", async () => {
		const root = await fixtureCopy("python-project");
		const report = await auditWorkspace(root, { now: NOW });
		const rows = languageCoverage(report);
		const python = rows.find((row) => row.language === "python");
		if (python === undefined) throw new Error("missing Python language coverage");

		expect(report.completeness).toBe("complete");
		expect(report.sourceCoverage.unsupported).toBeUndefined();
		expect(python).toMatchObject({ parseFailureFiles: 0, unresolvedImports: 0, dynamicImports: 0 });
		expect(report.metrics["complexity.functions.production"]?.value).toBeGreaterThan(0);
		expect(report.metrics["erosion.eroded-count.production"]?.value).toBeGreaterThan(0);
		expect(report.metrics["duplication.groups.production"]?.value).toBeGreaterThan(0);
		expect(report.metrics["import-cycle.groups"]?.value).toBeGreaterThan(0);

		const hotspotPaths = report.findings
			.filter((finding) => finding.kind === "complexity.hotspot")
			.map((finding) => finding.path);
		expect(hotspotPaths).toContain("src/complexity.py");
		expect(report.findings.some((finding) => finding.kind === "duplication.clone-group")).toBe(
			true,
		);
		expect(report.findings.some((finding) => finding.kind === "import-cycle")).toBe(true);
		expect(report.findings.some((finding) => finding.path === "src/app/engine.py")).toBe(true);

		const identityFindings = report.findings.filter(
			(finding) =>
				finding.kind === "complexity.hotspot" &&
				(finding.facts?.name === "dispatch" || finding.facts?.name === "route_records"),
		);
		expect(identityFindings.some((finding) => identityOf(finding)?.state === "identified")).toBe(
			true,
		);
	});

	test("keeps Python hotspot identity persistent across comments and line shifts", async () => {
		const root = await fixtureCopy("python-project");
		const before = await auditWorkspace(root, { now: NOW });
		const path = join(root, "src/complexity.py");
		const source = await readFile(path, "utf8");
		await writeFile(path, `# a harmless leading comment\n# another comment\n\n${source}`);
		const after = await auditWorkspace(root, { now: NOW });
		const comparison = compareReports(before, after);
		if (comparison.findings === undefined) throw new Error("Python reports were not comparable");
		const shifted = comparison.findings.persistent.find(
			(pair) =>
				pair.current.path === "src/complexity.py" && pair.current.facts?.name === "route_records",
		);

		expect(shifted).toBeDefined();
		expect(shifted?.lineShift).toBeGreaterThan(0);
		expect(
			comparison.findings.new.some(
				(finding) =>
					finding.path === "src/complexity.py" && finding.facts?.name === "route_records",
			),
		).toBe(false);
	});

	test("distinguishes replaced Python functions and same-named methods by class scope", async () => {
		const root = await fixtureCopy("python-project");
		const before = await auditWorkspace(root, { now: NOW });
		const path = join(root, "src/identity.py");
		const source = await readFile(path, "utf8");
		const replacement = [
			"class Alpha:",
			"\tdef dispatch(self, value):",
			"\t\treturn value",
			"",
		].join("\n");
		const marker = "class Beta:";
		const markerIndex = source.indexOf(marker);
		if (markerIndex < 0) throw new Error("missing Beta marker");
		await writeFile(path, `${replacement}${source.slice(markerIndex)}`);
		const after = await auditWorkspace(root, { now: NOW });
		const comparison = compareReports(before, after);
		if (comparison.findings === undefined) throw new Error("Python reports were not comparable");
		const beforeMethods = before.findings.filter(
			(finding) => finding.kind === "complexity.hotspot" && finding.facts?.name === "dispatch",
		);
		const alpha = beforeMethods.find((finding) => hasClassScope(finding, "Alpha"));
		const beta = beforeMethods.find((finding) => hasClassScope(finding, "Beta"));
		expect(alpha).toBeDefined();
		expect(beta).toBeDefined();
		expect(
			comparison.findings.resolved.some(
				(finding) =>
					finding.kind === "complexity.hotspot" &&
					finding.identity?.state === "identified" &&
					finding.identity.scopes.some((scope) => scope.name === "Alpha"),
			),
		).toBe(true);
		expect(
			comparison.findings.persistent.some(
				(pair) =>
					pair.current.kind === "complexity.hotspot" &&
					pair.current.identity?.state === "identified" &&
					pair.current.identity.scopes.some((scope) => scope.name === "Beta"),
			),
		).toBe(true);
	});
});

describe("mixed-language, partial-analysis and history acceptance", () => {
	test("keeps unsupported languages visible without changing Python measurements", async () => {
		const root = await fixtureCopy("python-project");
		const baseline = await auditWorkspace(root, { now: NOW });
		await writeFile(join(root, "external.go"), "package main\nfunc main() {}\n");
		const report = await auditWorkspace(root, { now: NOW });
		expect(report.sourceCoverage.unsupported).toEqual({
			files: 1,
			note: "unsupported source files, not analyzed",
		});
		expect(report.metrics).toEqual(baseline.metrics);
		expect(report.score).toEqual(baseline.score);
	});

	test("assembles one report containing TypeScript and Python complexity, cycles and clones", async () => {
		const root = await fixtureCopy("mixed-project");
		const report = await auditWorkspace(root, { now: NOW });
		const rows = languageCoverage(report);
		expect(rows.map((row) => row.language)).toEqual(["python", "typescript"]);
		expect(rows.every((row) => row.analyzedFiles > 0)).toBe(true);
		expect(report.sourceCoverage.production.files).toBeGreaterThanOrEqual(7);
		expect(
			report.findings.some(
				(finding) => finding.kind === "complexity.hotspot" && finding.path.endsWith(".ts"),
			),
		).toBe(true);
		expect(
			report.findings.some(
				(finding) => finding.kind === "complexity.hotspot" && finding.path.endsWith(".py"),
			),
		).toBe(true);
		expect(report.findings.filter((finding) => finding.kind === "import-cycle")).toHaveLength(2);
		expect(
			report.findings.some(
				(finding) => finding.kind === "duplication.clone-group" && finding.path.endsWith(".py"),
			),
		).toBe(true);
	});

	test("marks malformed indentation incomplete instead of treating recovered Python as clean", async () => {
		const root = await fixtureCopy("python-project");
		await mkdir(join(root, "src", "broken"), { recursive: true });
		await writeFile(
			join(root, "src", "broken", "indentation.py"),
			"def broken():\n\tvalue = 1\n  return value\n",
		);
		const report = await auditWorkspace(root, { now: NOW });
		const python = languageCoverage(report).find((row) => row.language === "python");
		if (python === undefined) throw new Error("missing Python language coverage");

		expect(report.completeness).toBe("incomplete");
		expect(report.score.partial).toBe(true);
		expect(python.parseFailureFiles).toBeGreaterThan(0);
		expect(report.metrics["complexity.functions.production"]?.state).toBe("incomplete");
	});

	test("scores declared Python cycles while locating unknown runtime imports", async () => {
		const root = await fixtureCopy("python-project");
		const path = join(root, "src", "dynamic.py");
		await writeFile(path, "module_name = 'unknown'\nvalue = __import__(module_name)\n");
		const report = await auditWorkspace(root, { now: NOW });
		const python = languageCoverage(report).find((row) => row.language === "python");
		expect(report.completeness).toBe("complete");
		expect(report.score.partial).toBe(false);
		expect(report.score.index).not.toBeNull();
		expect(report.metrics["graph.edges.unresolved"]).toMatchObject({
			state: "complete",
			value: 1,
		});
		expect(report.metrics["import-cycle.groups"]?.state).toBe("complete");
		expect(python).toMatchObject({ dynamicImports: 1, unresolvedImports: 1 });
		expect(
			report.findings.some(
				(finding) =>
					finding.kind === "graph.unresolved-import" && finding.path === "src/dynamic.py",
			),
		).toBe(true);
	});

	test("reports non-UTF-8 Python source as incomplete instead of decoding replacement text", async () => {
		const root = await fixtureCopy("python-project");
		await writeFile(join(root, "src", "latin1.py"), Buffer.from([0x23, 0x20, 0xe9, 0x0a]));
		const report = await auditWorkspace(root, { now: NOW });
		const python = languageCoverage(report).find((row) => row.language === "python");
		expect(report.completeness).toBe("incomplete");
		expect(python?.parseFailureFiles).toBe(1);
		expect(report.score.partial).toBe(true);
		expect(report.score.index).toBeNull();
		expect(report.score.unknownDimensions?.length ?? 0).toBeGreaterThan(0);
	});

	test("keeps Python baselines, policy and SQLite history on the shared run service", async () => {
		const root = await fixtureCopy("python-project");
		const db = join(root, "history.db");
		const config = {
			source: { exclude: [], classify: {} },
			providers: {},
			policy: { maxIndex: 0, budgets: {}, failOnNew: [], requireEvidence: [] },
		};
		const first = await runWorkspaceAudit(root, { config, history: true, db, now: NOW });
		expect(first.historyRunId).toBeGreaterThan(0);
		expect(first.baseline).toBeUndefined();
		expect(first.policy.failed).toBe(true);

		const second = await runWorkspaceAudit(root, {
			config,
			history: true,
			db,
			now: new Date("2026-01-02T00:00:00.000Z"),
		});
		expect(second.historyRunId).toBeGreaterThan(first.historyRunId ?? 0);
		expect(second.baseline?.score.index).toBe(first.report.score.index);
		expect(second.policy.failed).toBe(true);
	});

	test("audits a representative Python corpus within a generous local bound", async () => {
		const root = await fixtureCopy("python-project");
		await mkdir(join(root, "src", "bulk"), { recursive: true });
		await Promise.all(
			Array.from({ length: 120 }, (_, index) =>
				writeFile(
					join(root, "src", "bulk", `module_${index}.py`),
					`def transform_${index}(items):\n    total = 0\n    for value in items:\n        if value > 0:\n            total += value\n    return total\n`,
				),
			),
		);
		const started = performance.now();
		const report = await auditWorkspace(root, { now: NOW });
		const elapsedMs = performance.now() - started;
		expect(report.completeness).toBe("complete");
		expect(languageCoverage(report).find((row) => row.language === "python")?.analyzedFiles).toBe(
			129,
		);
		expect(elapsedMs).toBeLessThan(10_000);
	});
});
