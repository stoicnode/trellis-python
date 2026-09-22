import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "../audit/index.ts";
import { audit as sdkAudit } from "../client/index.ts";
import { compareReports } from "../compare/compare.ts";
import { assessPolicy } from "../compare/policy.ts";
import { auditConfigSchema, auditReportSchema, measurementPayload } from "../contract/index.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(path: string, content: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-documentation-"));
	roots.push(root);
	await mkdir(join(root, path, ".."), { recursive: true });
	await writeFile(join(root, path), content);
	return root;
}

function pythonDoc(lines: number): string {
	return `"""${Array.from({ length: lines }, (_, index) => `word${index}`).join("\n")}"""\nvalue = 1\n`;
}

function tsDoc(lines: number): string {
	return `/**\n${Array.from({ length: lines }, (_, index) => ` * word${index}`).join("\n")}\n */\nexport function value() { return 1; }\n`;
}

describe("advisory documentation analysis", () => {
	test("flags 41 content lines but not 39 or 40, in Python and attached TypeScript JSDoc", async () => {
		const root = await workspace("src/a.py", pythonDoc(39));
		for (const count of [39, 40, 41]) {
			await writeFile(join(root, "src/a.py"), pythonDoc(count));
			await writeFile(join(root, "src/b.ts"), tsDoc(count));
			const report = await auditWorkspace(root);
			expect(report.metrics["documentation.blocks.production"]?.value).toBe(2);
			expect(report.metrics["documentation.excessive.production"]?.value).toBe(count > 40 ? 2 : 0);
			expect(
				report.findings.filter((finding) => finding.kind === "documentation.excessive"),
			).toHaveLength(count > 40 ? 2 : 0);
			if (count === 41) {
				const python = report.findings.find(
					(finding) => finding.kind === "documentation.excessive" && finding.path.endsWith(".py"),
				);
				expect(python?.facts).toMatchObject({
					contentLines: 41,
					words: 41,
					maxContentLines: 40,
					maxWords: 300,
					exceededLines: true,
					exceededWords: false,
					ownerKey: "module",
					identityState: "identified",
				});
			}
		}
	});

	test("flags 301 physical words but not 299 or 300 without evaluating escapes", async () => {
		const root = await workspace("src/a.py", "");
		for (const count of [299, 300, 301]) {
			await writeFile(join(root, "src/a.py"), `"""${"w ".repeat(count)}"""\n`);
			const report = await auditWorkspace(root);
			expect(report.metrics["documentation.excessive.production"]?.value).toBe(count > 300 ? 1 : 0);
			if (count === 301)
				expect(
					report.findings.find((finding) => finding.kind === "documentation.excessive")?.facts,
				).toMatchObject({ contentLines: 1, words: 301, exceededLines: false, exceededWords: true });
		}
	});

	test("counts content through blank padding, CRLF, Unicode whitespace, and JSDoc markers", async () => {
		const root = await workspace(
			"src/a.py",
			`"""\r\n\r\n${"one\u2003two\r\n".repeat(40)}\r\n"""\r\nvalue = """${"word ".repeat(310)}"""\r\n`,
		);
		await writeFile(
			join(root, "src/b.ts"),
			`/**\r\n *\r\n${" * one\u2003two\r\n".repeat(40)} *\r\n */\r\nexport const value = 1;\r\nconst ordinary = \`${"word ".repeat(310)}\`;\r\n`,
		);
		const report = await auditWorkspace(root);
		expect(report.metrics["documentation.blocks.production"]?.value).toBe(2);
		expect(report.metrics["documentation.excessive.production"]?.value).toBe(0);
		expect(
			report.findings.filter((finding) => finding.kind === "documentation.excessive"),
		).toHaveLength(0);
	});

	test("locates nested owners and separates test documentation from production", async () => {
		const root = await workspace(
			"src/a.py",
			`class Outer:\n    class Inner:\n        def method(self):\n            """${"word ".repeat(301)}"""\n            return 1\n`,
		);
		await writeFile(join(root, "src/a.test.ts"), tsDoc(41));
		const report = await auditWorkspace(root);
		expect(report.metrics["documentation.excessive.production"]?.value).toBe(1);
		expect(report.metrics["documentation.excessive.test"]?.value).toBe(1);
		expect(
			report.findings.find(
				(finding) => finding.kind === "documentation.excessive" && finding.path.endsWith(".py"),
			)?.facts,
		).toMatchObject({
			sourceSet: "production",
			ownerKey: "class:Outer/class:Inner/function:method",
			contentLines: 1,
			words: 301,
		});
	});

	test("counts one-line JSDoc and records both exceeded thresholds on one block", async () => {
		const root = await workspace(
			"src/a.ts",
			"/** short note */\nexport function one() { return 1; }\n",
		);
		await writeFile(
			join(root, "src/b.ts"),
			`/**\n${Array.from({ length: 41 }, () => ` * ${"word ".repeat(8)}`).join("\n")}\n */\nexport function long() { return 1; }\n`,
		);
		const report = await auditWorkspace(root);
		expect(report.metrics["documentation.blocks.production"]?.value).toBe(2);
		expect(report.metrics["documentation.excessive.production"]?.value).toBe(1);
		expect(
			report.findings.find((finding) => finding.kind === "documentation.excessive")?.facts,
		).toMatchObject({
			contentLines: 41,
			words: 328,
			exceededLines: true,
			exceededWords: true,
			ownerKey: "FunctionDeclaration:long",
		});
	});

	test("keeps scored measurements stable when only a docstring grows", async () => {
		const root = await workspace("src/a.py", `def value():\n    """short"""\n    return 1\n`);
		const before = await auditWorkspace(root);
		await writeFile(
			join(root, "src/a.py"),
			`def value():\n    """${"word ".repeat(301)}"""\n    return 1\n`,
		);
		const after = await auditWorkspace(root);
		expect(after.score).toEqual(before.score);
		for (const id of [
			"erosion.mass.production",
			"duplication.density.production",
			"complexity.executable-sloc.production",
		])
			expect(after.metrics[id]).toEqual(before.metrics[id]);
		expect(after.metrics["documentation.excessive.production"]?.value).toBe(1);
	});

	test("keeps findings advisory and validates strict operator thresholds", async () => {
		const root = await workspace("src/a.py", pythonDoc(41));
		const defaultReport = await auditWorkspace(root);
		const disabled = await auditWorkspace(root, {
			config: auditConfigSchema.parse({ documentation: { enabled: false } }),
		});
		expect(defaultReport.score.index).toBe(disabled.score.index);
		expect(disabled.metrics["documentation.excessive.production"]?.value).toBe(0);
		expect(
			disabled.findings.filter((finding) => finding.kind === "documentation.excessive"),
		).toHaveLength(0);
		const lowered = await auditWorkspace(root, {
			config: auditConfigSchema.parse({ documentation: { maxContentLines: 1, maxWords: 1000 } }),
		});
		expect(
			lowered.findings.find((finding) => finding.kind === "documentation.excessive")?.facts,
		).toMatchObject({ maxContentLines: 1, maxWords: 1000 });
		for (const documentation of [
			{ maxContentLines: 0 },
			{ maxWords: -1 },
			{ maxWords: 1.5 },
			{ maxWords: 300, command: "echo unsafe" },
		])
			expect(auditConfigSchema.safeParse({ documentation }).success).toBe(false);
		const policy = { budgets: {}, failOnNew: ["documentation.excessive"], requireEvidence: [] };
		expect(assessPolicy(defaultReport, policy).failed).toBe(false);
	});

	test("pairs named findings across line shifts and withholds changed-threshold deltas", async () => {
		const root = await workspace("src/a.py", pythonDoc(41));
		const before = await auditWorkspace(root);
		await writeFile(join(root, "src/a.py"), `# leading note\n${pythonDoc(41)}`);
		const shifted = await auditWorkspace(root);
		const aligned = compareReports(before, shifted);
		expect(aligned.compatibility.comparable).toBe(true);
		expect(
			aligned.findings?.persistent.filter(
				(entry) => entry.current.kind === "documentation.excessive",
			),
		).toHaveLength(1);
		expect(
			aligned.findings?.new.filter((finding) => finding.kind === "documentation.excessive"),
		).toHaveLength(0);
		const changed = await auditWorkspace(root, {
			config: auditConfigSchema.parse({ documentation: { maxContentLines: 50 } }),
		});
		const comparison = compareReports(before, changed);
		expect(comparison.compatibility.comparable).toBe(true);
		expect(comparison.compatibility.caveats).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "advisory-measurement" })]),
		);
		expect(comparison.score?.delta).toBe(0);
		expect(comparison.metrics?.some((metric) => metric.id.startsWith("documentation."))).toBe(
			false,
		);
		expect(
			comparison.findings?.resolved.some((finding) => finding.kind === "documentation.excessive"),
		).toBe(false);
		const policy = { budgets: {}, failOnNew: ["documentation.excessive"], requireEvidence: [] };
		expect(assessPolicy(changed, policy, { baseline: before }).results[0]).toMatchObject({
			status: "fail",
			reasons: [{ code: "baseline-incompatible" }],
		});
	});

	test("gates a newly excessive block identically through CLI and SDK", async () => {
		const root = await workspace("src/a.py", pythonDoc(40));
		const baseline = await auditWorkspace(root);
		const baselinePath = join(root, "baseline.json");
		await writeFile(baselinePath, JSON.stringify(baseline));
		await writeFile(join(root, "src/a.py"), pythonDoc(41));
		await writeFile(
			join(root, "trellis.yaml"),
			"policy:\n  failOnNew:\n    - documentation.excessive\n",
		);
		const sdk = await sdkAudit(root, { baselinePath });
		expect(sdk.policy.failed).toBe(true);
		expect(sdk.policy.results[0]?.reasons[0]?.code).toBe("new-finding");
		const child = Bun.spawn(
			[
				process.execPath,
				join(import.meta.dir, "../cli/main.ts"),
				"audit",
				root,
				"--json",
				"--baseline",
				baselinePath,
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
		expect(code).toBe(2);
		expect(measurementPayload(auditReportSchema.parse(JSON.parse(stdout)))).toEqual(
			measurementPayload(sdk.report),
		);
	});
});
