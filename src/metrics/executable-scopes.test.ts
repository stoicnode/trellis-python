import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "../audit/index.ts";
import { compareReports } from "../compare/compare.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(filename: string, content: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-executable-scopes-"));
	roots.push(root);
	await writeFile(join(root, filename), content);
	return root;
}

describe("advisory executable scopes", () => {
	test("locates module branching without inventing a function or changing the score", async () => {
		for (const [name, content] of [
			["scope.py", "value = 1 if flag else 0\n"],
			["scope.ts", "export const value = flag ? 1 : 0;\n"],
		] as const) {
			const root = await workspace(name, content);
			const report = await auditWorkspace(root);
			expect(report.metrics["complexity.functions.production"]?.value).toBe(0);
			expect(report.metrics["executable.initialization.decisions.production"]?.value).toBe(1);
			expect(
				report.findings.find((f) => f.kind === "executable.initialization")?.facts,
			).toMatchObject({ ownerKind: "module", decisions: 1, ownerKey: "module" });
			expect(report.score.index).toBe(0);
		}
	});

	test("separates function bodies from definition-time defaults and class initialization", async () => {
		const python = await workspace(
			"scope.py",
			"class Box:\n    value = 1 if flag else 0\n    def method(self, x=2 if flag else 3):\n        return 4 if x else 5\n",
		);
		const typescript = await workspace(
			"scope.ts",
			"export class Box {\n  static value = flag ? 1 : 0;\n  method(x = flag ? 2 : 3) { return x ? 4 : 5; }\n}\n",
		);
		for (const root of [python, typescript]) {
			const report = await auditWorkspace(root);
			const init = report.findings.find((f) => f.kind === "executable.initialization");
			expect(init?.facts).toMatchObject({ ownerKind: "class", decisions: 2 });
			expect(report.metrics["executable.initialization.decisions.production"]?.value).toBe(2);
			expect(report.metrics["complexity.functions.production"]?.value).toBe(1);
		}
	});

	test("locates nesting below CC 11 and pairs stable owners across line shifts", async () => {
		const root = await workspace(
			"scope.py",
			"def walk(a, b, c):\n    if a:\n        if b:\n            if c:\n                return 1\n    return 0\n",
		);
		const before = await auditWorkspace(root);
		expect(before.findings.some((f) => f.kind === "complexity.hotspot")).toBe(false);
		const nesting = before.findings.find((f) => f.kind === "executable.nesting");
		expect(nesting?.range.start.line).toBe(4);
		expect(nesting?.facts).toMatchObject({ ownerKind: "function", maxNesting: 3 });
		expect(before.metrics["executable.nesting.max.production"]?.detail).toMatchObject({
			worst: { path: "scope.py", ownerKind: "function", ownerName: "walk" },
		});
		await writeFile(
			join(root, "scope.py"),
			"# shifted\n" +
				"def walk(a, b, c):\n    if a:\n        if b:\n            if c:\n                return 1\n    return 0\n",
		);
		const after = await auditWorkspace(root);
		const comparison = compareReports(before, after);
		expect(
			comparison.findings?.persistent.some(
				(f) => f.current.kind === "executable.nesting" && f.lineShift === 1,
			),
		).toBe(true);
	});

	test("keeps elif and else if at one level and resets depth in nested functions", async () => {
		const python = await workspace(
			"scope.py",
			"if a:\n    value = 1\nelif b:\n    value = 2\nelse:\n    value = 3\ndef outer():\n    if a:\n        def inner():\n            if b:\n                return 1\n        return inner()\n",
		);
		const typescript = await workspace(
			"scope.ts",
			"if (a) { value = 1; } else if (b) { value = 2; } else { value = 3; }\nfunction outer() { if (a) { function inner() { if (b) return 1; } return inner(); } }\n",
		);
		for (const root of [python, typescript]) {
			const report = await auditWorkspace(root);
			expect(report.metrics["executable.nesting.max.production"]?.value).toBe(1);
			expect(report.metrics["executable.initialization.decisions.production"]?.value).toBe(2);
			expect(report.findings.filter((f) => f.kind === "executable.nesting")).toHaveLength(0);
		}
	});

	test("counts switch or match, handlers and comprehensions by documented control levels", async () => {
		const python = await workspace(
			"scope.py",
			"def walk(x, rows):\n    match x:\n        case 1:\n            if rows:\n                return [v for v in rows if v]\n    try:\n        return 0\n    except ValueError:\n        if rows:\n            return 1\n",
		);
		const typescript = await workspace(
			"scope.ts",
			"function walk(x: number, rows: number[]) {\n  switch (x) { case 1: if (rows.length) return rows.map(v => v ? v : 0); }\n  try { return 0; } catch { if (rows.length) return 1; }\n}\n",
		);
		for (const root of [python, typescript]) {
			const report = await auditWorkspace(root);
			expect(report.metrics["executable.nesting.max.production"]?.value).toBeGreaterThanOrEqual(2);
			expect(report.findings.filter((f) => f.kind === "executable.initialization")).toHaveLength(0);
		}
	});

	test("credits class headers and decorators to the outer scope", async () => {
		const python = await workspace(
			"scope.py",
			"class Box(A if flag else B):\n    @ (decorate_a if flag else decorate_b)\n    def method(self):\n        return 1\n",
		);
		const typescript = await workspace(
			"scope.ts",
			"@((flag ? decorateA : decorateB))\nclass Box extends (flag ? A : B) { method() { return 1; } }\n",
		);
		for (const root of [python, typescript]) {
			const report = await auditWorkspace(root);
			const module = report.findings.find(
				(f) => f.kind === "executable.initialization" && f.facts?.ownerKind === "module",
			);
			expect(module?.facts?.decisions).toBeGreaterThanOrEqual(1);
			expect(report.metrics["complexity.functions.production"]?.value).toBe(1);
		}
	});

	test("reports raw nesting severity changes when the rounded index stays fixed", async () => {
		const root = await workspace(
			"scope.py",
			"def walk(a, b, c, d):\n    if a:\n        if b:\n            if c:\n                return 1\n    return 0\n",
		);
		const before = await auditWorkspace(root);
		await writeFile(
			join(root, "scope.py"),
			"def walk(a, b, c, d):\n    if a:\n        if b:\n            if c:\n                if d:\n                    return 1\n    return 0\n",
		);
		const after = await auditWorkspace(root);
		const comparison = compareReports(before, after);
		expect(after.score.index).toBe(before.score.index);
		expect(before.metrics["executable.nesting.max.production"]?.value).toBe(3);
		expect(after.metrics["executable.nesting.max.production"]?.value).toBe(4);
		expect(
			comparison.metrics?.find((delta) => delta.id === "executable.nesting.max.production")?.delta,
		).toBe(1);
		expect(
			comparison.findings?.persistent.find((f) => f.current.kind === "executable.nesting")?.current
				.facts?.maxNesting,
		).toBe(4);
	});
});
