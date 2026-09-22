import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "../audit/index.ts";
import {
	renderAuditMarkdown,
	renderAuditTerminal,
	renderComparisonMarkdown,
	renderComparisonTerminal,
} from "../report/index.ts";
import { compareReports } from "./compare.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("comparison explanation", () => {
	test("exposes source, exact points, denominator and severity when index rounding hides change", async () => {
		const root = await mkdtemp(join(tmpdir(), "trellis-explain-"));
		roots.push(root);
		const path = join(root, "scope.py");
		await writeFile(
			path,
			"def walk(a, b, c, d):\n    if a:\n        if b:\n            if c:\n                return 1\n    return 0\n",
		);
		const before = await auditWorkspace(root);
		await writeFile(
			path,
			"def walk(a, b, c, d):\n    if a:\n        if b:\n            if c:\n                if d:\n                    return 1\n    return 0\n",
		);
		const after = await auditWorkspace(root);
		const result = compareReports(before, after);
		expect(result.score?.delta).toBe(0);
		expect(result.sourceInput).toBe("changed");
		expect(result.explanation?.dimensionChanges).toHaveLength(3);
		expect(
			result.explanation?.denominatorChanges.some(
				(row) => row.metricId === "erosion.eroded-share.production",
			),
		).toBe(true);
		expect(result.explanation?.persistentSeverityChanges).toContainEqual(
			expect.objectContaining({
				kind: "executable.nesting",
				field: "maxNesting",
				baseline: 3,
				current: 4,
			}),
		);
		const terminal = renderComparisonTerminal(result, before, after);
		const markdown = renderComparisonMarkdown(result, before, after);
		for (const text of [terminal, markdown]) {
			expect(text).toContain("Index unchanged while");
			expect(text.toLowerCase()).toContain("exact");
			expect(text.toLowerCase()).toContain("points");
			expect(text).toContain("erosion.eroded-share.production");
			expect(text).toContain("maxNesting");
		}
	});

	test("separates documentation and graph scope in both audit views", async () => {
		const root = await mkdtemp(join(tmpdir(), "trellis-explain-"));
		roots.push(root);
		await writeFile(
			join(root, "scope.py"),
			`"""${"word ".repeat(301)}"""\nvalue = 1 if flag else 0\n`,
		);
		const report = await auditWorkspace(root);
		for (const text of [renderAuditTerminal(report), renderAuditMarkdown(report)]) {
			expect(text.toLowerCase()).toContain("production burden");
			expect(text.toLowerCase()).toContain("graph scope and observation limits");
			expect(text.toLowerCase()).toContain("documentation review (advisory");
			expect(text).toContain("301");
			expect(text).toContain("default quality cutoff");
		}
	});

	test("retains source provenance when analyzer versions make score deltas incompatible", async () => {
		const root = await mkdtemp(join(tmpdir(), "trellis-explain-"));
		roots.push(root);
		await writeFile(join(root, "scope.py"), "value = 1\n");
		const report = await auditWorkspace(root);
		const changed = { ...report, analyzerVersion: "99.0.0" };
		const result = compareReports(report, changed);
		expect(result.compatibility.comparable).toBe(false);
		expect(result.sourceInput).toBe("unchanged");
		expect(result.explanation).toBeUndefined();
		expect(renderComparisonTerminal(result, report, changed)).toContain(
			"Native source snapshot is unchanged",
		);
	});
});
