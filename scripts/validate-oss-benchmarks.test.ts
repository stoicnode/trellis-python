import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runWorkspaceAudit } from "../src/audit/index.ts";
import { auditPinnedAcceptance, pinnedFindingEvidence } from "./oss-benchmark-acceptance.ts";
import { readPreparationArgs } from "./oss-benchmark-cli.ts";
import {
	auditPinnedRepositories,
	auditPostFixPython,
	equalReasonCounts,
	fixtureSnapshot,
	loadOssBenchmarkManifest,
	main,
	measureFixtureInChildProcess,
	peakRssMb,
	pythonDiagnostics,
	runOssBenchmark,
	unresolvedReasons,
	verifyBaselineArtifacts,
	verifyPinnedRepositories,
} from "./validate-oss-benchmarks.ts";

const ROOT = resolve(import.meta.dir, "../corpus/oss-benchmark");
const temporaryRoots: string[] = [];
afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
	);
});

function git(root: string, ...args: string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

async function preparedMiniRepository(): Promise<{
	manifestRoot: string;
	preparedRoot: string;
	artifactRoot: string;
	repoRoot: string;
}> {
	const root = await mkdtemp(join(tmpdir(), "trellis-oss-benchmark-test-"));
	temporaryRoots.push(root);
	const manifestRoot = join(root, "manifest");
	const preparedRoot = join(root, "prepared");
	const artifactRoot = join(root, "artifacts");
	const repoRoot = join(preparedRoot, "mini");
	await Promise.all([
		mkdir(manifestRoot),
		mkdir(repoRoot, { recursive: true }),
		mkdir(artifactRoot),
	]);
	await writeFile(join(repoRoot, "index.ts"), "export const value = 1;\n");
	git(repoRoot, "init", "-q");
	git(repoRoot, "add", "index.ts");
	git(
		repoRoot,
		"-c",
		"user.name=Trellis",
		"-c",
		"user.email=trellis@example.test",
		"commit",
		"-qm",
		"pin source",
	);
	const report = (await runWorkspaceAudit(repoRoot, { now: new Date("2026-09-22T00:00:00.000Z") }))
		.report;
	const baseline = {
		id: "mini",
		index: report.score.index,
		completeness: report.completeness,
		production: report.sourceCoverage.production,
		parseFailures: 0,
		unresolvedReasons: {},
	};
	const fixtures = Array.from({ length: 5 }, (_, index) => ({
		id: `unused-${index}`,
		path: `fixtures/unused-${index}`,
		snapshot: "",
	}));
	await writeFile(
		join(manifestRoot, "manifest.json"),
		JSON.stringify({
			version: 1,
			repositories: [
				{
					id: "mini",
					commit: git(repoRoot, "rev-parse", "HEAD"),
					tree: git(repoRoot, "rev-parse", "HEAD^{tree}"),
				},
			],
			baselines: [baseline],
			fixtures,
		}),
	);
	await writeFile(join(artifactRoot, "mini.json"), JSON.stringify(report));
	return { manifestRoot, preparedRoot, artifactRoot, repoRoot };
}

describe("open-source benchmark baseline", () => {
	test("compares reason counts independent of key order and reports a process peak", () => {
		expect(
			equalReasonCounts({ "no-target": 2, ambiguous: 1 }, { ambiguous: 1, "no-target": 2 }),
		).toBe(true);
		expect(equalReasonCounts({ "no-target": 2 }, { "no-target": 1 })).toBe(false);
		expect(peakRssMb()).toBeGreaterThan(0);
	});

	test("keeps valid and malformed parser controls separate in the frozen snapshot", async () => {
		const manifest = loadOssBenchmarkManifest(ROOT);
		const fixture = manifest.fixtures.find((entry) => entry.id === "parser-recovery");
		if (fixture === undefined) throw new Error("missing parser-recovery fixture");
		const fixtureRoot = resolve(ROOT, "fixtures/parser-recovery");
		expect(await fixtureSnapshot(fixtureRoot)).toBe(fixture.snapshot);
		const byPath = Object.fromEntries(
			(await pythonDiagnostics(fixtureRoot)).map((entry) => [entry.path, entry.codes]),
		);
		expect(byPath["src/session.py"]).toEqual([]);
		expect(byPath["src/recovery.py"]).toContain("PY-SYNTAX");
		const dynamicRoot = resolve(ROOT, "fixtures/static-import-uncertainty");
		const dynamic = (await runWorkspaceAudit(dynamicRoot)).report;
		expect(unresolvedReasons(dynamic)).toEqual({ "non-literal-dynamic": 1 });
		const finding = dynamic.findings[0];
		if (finding === undefined) throw new Error("missing dynamic import finding");
		expect(pinnedFindingEvidence(finding)).toMatchObject({
			kind: "graph.unresolved-import",
			path: "src/dynamic.ts",
			range: { start: 2, end: 2 },
		});
	});

	test("freezes the pinned external baseline and audits every distilled taxonomy fixture", async () => {
		const manifest = loadOssBenchmarkManifest(ROOT);
		expect(manifest.repositories.map((entry) => entry.id)).toEqual(
			expect.arrayContaining(["zod", "date-fns", "tanstack-query", "requests", "flask", "rich"]),
		);
		expect(manifest.baselines).toHaveLength(10);
		expect(manifest.baselines.find((entry) => entry.id === "rich")).toMatchObject({
			index: 100,
			completeness: "incomplete",
			unresolvedReasons: { "no-target": 578, "non-literal-dynamic": 3 },
		});
		const record = await runOssBenchmark(ROOT);
		expect(record.ok).toBe(true);
		expect(record.fixtures.map((fixture) => fixture.id)).toEqual([
			"parser-recovery",
			"indentation",
			"static-import-uncertainty",
			"unsupported-exports",
			"resource-exhaustion",
		]);
		for (const fixture of record.fixtures) {
			expect(fixture.snapshot.matches).toBe(true);
			expect(fixture.measurement.durationMs).toBeGreaterThanOrEqual(0);
			expect(fixture.measurement.peakRssMb).toBeGreaterThan(0);
			expect(fixture.scoreContributions.length).toBeGreaterThan(0);
		}
		const byId = Object.fromEntries(record.fixtures.map((fixture) => [fixture.id, fixture]));
		expect(byId["parser-recovery"]?.completeness).toBe("incomplete");
		expect(byId["parser-recovery"]?.diagnostics.flatMap((entry) => entry.codes)).toContain(
			"PY-SYNTAX",
		);
		expect(byId.indentation?.completeness).toBe("incomplete");
		expect(byId.indentation?.diagnostics.flatMap((entry) => entry.codes)).toContain("PY-INDENT");
		expect(byId["static-import-uncertainty"]?.unresolvedReasons).toEqual({
			"non-literal-dynamic": 1,
		});
		expect(byId["static-import-uncertainty"]?.sourceCoverage.production.files).toBe(2);
		expect(byId["static-import-uncertainty"]?.metrics["import-cycle.groups"]).toMatchObject({
			state: "incomplete",
		});
		expect(byId["unsupported-exports"]?.unresolvedReasons).toEqual({ "unsupported-exports": 1 });
		for (const id of [
			"duplication.groups.production",
			"duplication.duplicated-lines.production",
			"duplication.density.production",
		]) {
			expect(byId["resource-exhaustion"]?.metrics[id]).toMatchObject({
				state: "incomplete",
				value: null,
				reason: expect.stringContaining("match-work budget"),
			});
		}
	});

	test("measures each fixture in a fresh audit process", () => {
		const measured = measureFixtureInChildProcess(ROOT, "static-import-uncertainty");
		expect(measured.id).toBe("static-import-uncertainty");
		expect(measured.measurement.peakRssMb).toBeGreaterThan(0);
		expect(measured.snapshot.matches).toBe(true);
		expect(() => measureFixtureInChildProcess(ROOT, "missing")).toThrow(
			"fixture measurement child failed",
		);
	});

	test("verifies and re-audits an offline pinned checkout through the preparation command", async () => {
		const { manifestRoot, preparedRoot, artifactRoot, repoRoot } = await preparedMiniRepository();
		expect(verifyPinnedRepositories(manifestRoot, preparedRoot)).toEqual([]);
		expect(await verifyBaselineArtifacts(manifestRoot, artifactRoot)).toEqual([]);
		const rerun = await auditPinnedRepositories(manifestRoot, preparedRoot);
		expect(rerun.mismatches).toEqual([]);
		expect(rerun.records).toHaveLength(1);
		expect(rerun.records[0]).toMatchObject({
			id: "mini",
			matches: true,
			measurement: { peakRssMb: expect.any(Number) },
		});
		const output: string[] = [];
		expect(
			await main(
				["--prepared-root", preparedRoot, "--artifact-root", artifactRoot, "--reaudit"],
				(text) => output.push(text),
				manifestRoot,
			),
		).toBe(0);
		expect(JSON.parse(output[0] ?? "{}").reAudit.records[0].matches).toBe(true);
		expect(verifyPinnedRepositories(manifestRoot, preparedRoot)).toEqual([]);
		await writeFile(join(repoRoot, "index.ts"), "export const value = 2;\n");
		expect(verifyPinnedRepositories(manifestRoot, preparedRoot)[0]).toContain("dirty");
		expect(verifyPinnedRepositories(manifestRoot, join(preparedRoot, "missing"))[0]).toContain(
			"unavailable",
		);
		expect((await auditPinnedRepositories(manifestRoot, preparedRoot)).records).toEqual([]);
	});

	test("records repeatable pinned acceptance evidence without comparing it to the frozen baseline", async () => {
		const { manifestRoot, preparedRoot } = await preparedMiniRepository();
		const acceptance = await auditPinnedAcceptance(manifestRoot, preparedRoot, 3);
		expect(acceptance.ok).toBe(true);
		expect(acceptance.runs).toBe(3);
		expect(acceptance.entries).toHaveLength(1);
		expect(acceptance.entries[0]).toMatchObject({
			id: "mini",
			repeatable: true,
			medianMs: expect.any(Number),
			peakRssMb: expect.any(Number),
			summary: {
				completeness: "complete",
				parseFailures: 0,
				unresolvedReasons: {},
			},
		});
		const output: string[] = [];
		expect(
			await main(
				["--prepared-root", preparedRoot, "--acceptance", "--runs", "3"],
				(text) => output.push(text),
				manifestRoot,
			),
		).toBe(0);
		expect(JSON.parse(output[0] ?? "{}").acceptance.entries[0].repeatable).toBe(true);
		await writeFile(join(preparedRoot, "mini", "index.ts"), "export const value = 2;\n");
		const dirty = await auditPinnedAcceptance(manifestRoot, preparedRoot, 3);
		expect(dirty).toMatchObject({ ok: false, entries: [] });
		expect(dirty.integrity[0]).toContain("dirty");
		expect(await auditPostFixPython(manifestRoot, preparedRoot)).toEqual([
			expect.objectContaining({ ok: false }),
		]);
		await expect(auditPinnedAcceptance(manifestRoot, preparedRoot, 0)).rejects.toThrow(
			"positive integer",
		);
		await expect(main(["--prepared-root", preparedRoot], () => {}, manifestRoot)).rejects.toThrow(
			"usage:",
		);
		expect(() =>
			readPreparationArgs(["--prepared-root", preparedRoot, "--acceptance", "--runs", "0"], true),
		).toThrow("positive integer");
	});

	test("returns baseline mismatches as evidence instead of revising the frozen expectation", async () => {
		const { manifestRoot, artifactRoot } = await preparedMiniRepository();
		await writeFile(
			join(artifactRoot, "mini.json"),
			JSON.stringify({
				completeness: "complete",
				findings: [{ kind: "graph.unresolved-import", facts: { reason: "no-target" } }],
			}),
		);
		const mismatches = await verifyBaselineArtifacts(manifestRoot, artifactRoot);
		expect(mismatches).toHaveLength(1);
		expect(mismatches[0]).toContain("mini: baseline revision mismatch");
	});

	test("accepts parser-complete pinned Python roots without invoking Python", async () => {
		const root = await mkdtemp(join(tmpdir(), "trellis-python-acceptance-test-"));
		temporaryRoots.push(root);
		const manifestRoot = join(root, "manifest");
		const preparedRoot = join(root, "prepared");
		await Promise.all([mkdir(manifestRoot), mkdir(preparedRoot)]);
		const entries = [];
		for (const id of ["requests", "flask", "rich"]) {
			const repoRoot = join(preparedRoot, id);
			await mkdir(join(repoRoot, "src"), { recursive: true });
			await writeFile(join(repoRoot, "src", "main.py"), "def value():\n    return 1\n");
			git(repoRoot, "init", "-q");
			git(repoRoot, "add", "src/main.py");
			git(
				repoRoot,
				"-c",
				"user.name=Trellis",
				"-c",
				"user.email=trellis@example.test",
				"commit",
				"-qm",
				"pin source",
			);
			entries.push({
				id,
				revision: git(repoRoot, "rev-parse", "HEAD"),
				tree: git(repoRoot, "rev-parse", "HEAD^{tree}"),
				files: 1,
				astParseFailures: [],
			});
		}
		await writeFile(
			join(manifestRoot, "manifest.json"),
			JSON.stringify({
				version: 1,
				repositories: entries.map(({ id, revision, tree }) => ({ id, commit: revision, tree })),
				baselines: [],
				fixtures: Array.from({ length: 5 }, (_, index) => ({
					id: `unused-${index}`,
					path: `unused-${index}`,
					snapshot: "",
				})),
			}),
		);
		await writeFile(
			join(manifestRoot, "python-ast-parse.json"),
			JSON.stringify({
				purpose: "test-only pinned parser acceptance",
				interpreter: "python3",
				interpreterVersion: "not invoked by acceptance",
				entries,
			}),
		);
		const accepted = await auditPostFixPython(manifestRoot, preparedRoot);
		expect(accepted).toHaveLength(3);
		expect(accepted).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "requests",
					discoveredPythonFiles: 1,
					parseFailureFiles: 0,
					ok: true,
				}),
				expect.objectContaining({
					id: "flask",
					discoveredPythonFiles: 1,
					parseFailureFiles: 0,
					ok: true,
				}),
				expect.objectContaining({
					id: "rich",
					discoveredPythonFiles: 1,
					parseFailureFiles: 0,
					ok: true,
				}),
			]),
		);
	});
});
