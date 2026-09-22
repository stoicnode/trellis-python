import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "../audit/index.ts";
import { pythonDocstrings } from "./docstrings.ts";
import { parsePython, pythonLineKinds, pythonTokens } from "./parser.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-python-docstrings-"));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(join(root, path, ".."), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

const BODY = [
	"class Calculator:",
	"    def compute(self, value):",
	...Array.from({ length: 12 }, (_, index) => `        if value == ${index}: return ${index}`),
	"        data = '''runtime\n        multiline data'''",
	"        return data",
].join("\n");

describe("Python first-statement docstrings", () => {
	test("distinguishes module, class and function documentation from runtime strings", () => {
		const source = [
			'"""module text"""',
			"class C:",
			"    ('class ' 'text')",
			"    def f(self):",
			"        r'''function text'''",
			"        value = '''runtime text'''",
			"        return value",
			"    def g(self):",
			"        b'bytes are not docstrings'",
		].join("\n");
		const parsed = parsePython("src/module.py", source);
		expect(parsed.diagnostics).toEqual([]);
		const docs = pythonDocstrings(parsed.tree, source);
		expect(docs.map((doc) => doc.owner)).toEqual(["module", "class", "function"]);
		expect(docs.map((doc) => source.slice(doc.from, doc.to))).toEqual([
			'"""module text"""',
			"('class ' 'text')",
			"r'''function text'''",
		]);
		expect(pythonLineKinds(parsed.tree, source).lines.code).toBeGreaterThan(
			pythonLineKinds(parsed.tree, source, docs).lines.code,
		);
		expect(pythonTokens(parsed.tree, source, undefined, docs).length).toBeLessThan(
			pythonTokens(parsed.tree, source).length,
		);
	});

	test("preserves structural score, clones and hotspot identity across docstring expansion", async () => {
		const root = await workspace({ "src/a.py": BODY, "src/b.py": BODY });
		const before = await auditWorkspace(root);
		const documented = [
			'"""Module introduction.\nMore context.\n"""',
			"class Calculator:",
			"    '''Class API notes.\n    Additional detail.'''",
			"    def compute(self, value):",
			"        '''Function contract.\n        Additional example.'''",
			...BODY.split("\n").slice(2),
		].join("\n");
		await writeFile(join(root, "src/a.py"), documented);
		const after = await auditWorkspace(root);
		expect(after.score.index).toBe(before.score.index);
		for (const id of [
			"erosion.mass.production",
			"erosion.eroded-share.production",
			"duplication.groups.production",
			"duplication.duplicated-lines.production",
			"duplication.density.production",
			"complexity.executable-sloc.production",
		])
			expect(after.metrics[id]?.value).toBe(before.metrics[id]?.value);
		expect(after.metrics["complexity.functions.production"]?.detail?.sloc).toBeGreaterThan(
			before.metrics["complexity.functions.production"]?.detail?.sloc as number,
		);
		expect(
			after.findings
				.filter((finding) => finding.kind === "complexity.hotspot")
				.map((finding) => ("identity" in finding ? finding.identity : null)),
		).toEqual(
			before.findings
				.filter((finding) => finding.kind === "complexity.hotspot")
				.map((finding) => ("identity" in finding ? finding.identity : null)),
		);
	});

	test("keeps executable measurements across docstring rewrapping and comment edits", async () => {
		const root = await workspace({ "src/module.py": BODY });
		const before = await auditWorkspace(root);
		const variants = [
			`"""Short docs"""\n${BODY}`,
			`"""Unicode Ω\r\nreflowed across physical lines\r\n"""\r\n${BODY.replaceAll("\n", "\r\n")}`,
			`# comment only\n${BODY.replace("        return data", "        # explanation\n        return data")}`,
		];
		for (const source of variants) {
			await writeFile(join(root, "src/module.py"), source);
			const current = await auditWorkspace(root);
			expect(current.score.index).toBe(before.score.index);
			for (const id of [
				"erosion.mass.production",
				"erosion.eroded-share.production",
				"complexity.executable-sloc.production",
				"duplication.density.production",
			])
				expect(current.metrics[id]?.value).toBe(before.metrics[id]?.value);
		}
	});
});
