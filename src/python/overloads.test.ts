import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSourceInventory } from "../discovery/index.ts";
import { analyzeComplexity } from "../metrics/analyze.ts";
import { buildSyntaxInventory } from "../syntax/index.ts";
import { pythonFunctionInventory } from "./function-inventory.ts";
import { parsePython, pythonLineKinds } from "./parser.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(source: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-python-overloads-"));
	roots.push(root);
	await mkdir(join(root, "src"));
	await writeFile(join(root, "src/module.py"), source);
	return root;
}

function inventory(source: string) {
	const parsed = parsePython("src/module.py", source);
	const lines = pythonLineKinds(parsed.tree, source);
	return {
		diagnostics: parsed.diagnostics,
		...pythonFunctionInventory(parsed.tree, source, "production", lines.kinds),
	};
}

describe("Python overload inventory", () => {
	test("associates alias declarations with one executable implementation", () => {
		const base = "from typing import overload as ov\ndef choose(value):\n    return value\n";
		const overloaded = [
			"from typing import overload as ov",
			"@ov",
			"def choose(value: int) -> int: ...",
			"@ov",
			"def choose(value: str) -> str: ...",
			"def choose(value):",
			"    return value",
		].join("\n");
		const before = inventory(base);
		const after = inventory(overloaded);
		expect(after.diagnostics).toEqual([]);
		expect(after.signatureCount).toBe(2);
		expect(after.functions).toHaveLength(1);
		expect(after.functions[0]?.overloadSignatures).toBe(2);
		expect(after.functions[0]?.identity).toEqual(before.functions[0]?.identity);
		expect(after.functions[0]?.complexity).toEqual(before.functions[0]?.complexity);
		expect(after.functions[0]?.sloc).toBe(before.functions[0]?.sloc);
		expect(after.orphanOverloads).toEqual([]);
	});

	test("associates qualified overloads with async methods", () => {
		const source = [
			"import typing as t",
			"class Service:",
			"    @t.overload",
			"    async def run(self, value: int) -> int: ...",
			"    @t.overload",
			"    async def run(self, value: str) -> str: ...",
			"    async def run(self, value):",
			"        return value",
		].join("\n");
		const result = inventory(source);
		expect(result.diagnostics).toEqual([]);
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0]?.overloadSignatures).toBe(2);
		expect(result.functions[0]?.identity).toMatchObject({
			state: "identified",
			scopes: [{ kind: "class", name: "Service" }],
			function: { name: "run", member: "instance" },
		});
	});

	test("retains orphan declarations as located unscored findings", async () => {
		const root = await workspace(
			"from typing import overload\n@overload\ndef missing(x: int): ...\n",
		);
		const syntax = await buildSyntaxInventory(await discoverSourceInventory(root));
		const file = syntax.files.find((candidate) => candidate.path === "src/module.py");
		expect(file?.signatureCount).toBe(1);
		expect(file?.functions).toEqual([]);
		expect(analyzeComplexity(syntax).findings).toEqual([
			expect.objectContaining({
				kind: "python.orphan-overload",
				path: "src/module.py",
				facts: expect.objectContaining({ name: "missing", sourceSet: "production" }),
			}),
		]);
	});

	test("attaches conditional signatures to a following common implementation", () => {
		const source = [
			"from typing import overload",
			"if modern:",
			"    @overload",
			"    def make(value: int): ...",
			"else:",
			"    @overload",
			"    def make(value: str): ...",
			"def make(value):",
			"    return value",
		].join("\n");
		const result = inventory(source);
		expect(result.diagnostics).toEqual([]);
		expect(result.signatureCount).toBe(2);
		expect(result.functions).toHaveLength(1);
		expect(result.functions[0]?.overloadSignatures).toBe(2);
		expect(result.orphanOverloads).toEqual([]);
	});

	test("keeps rebound decorators and conditional implementations distinct", () => {
		const source = [
			"from typing import overload as ov",
			"ov = decorate",
			"@ov",
			"def same(x): return x",
			"if flag:",
			"    def same(x): return x + 1",
			"else:",
			"    def same(x): return x - 1",
		].join("\n");
		const result = inventory(source);
		expect(result.diagnostics).toEqual([]);
		expect(result.signatureCount).toBe(0);
		expect(result.functions).toHaveLength(3);
		expect(result.functions.every((fn) => fn.identity.state === "ambiguous")).toBe(true);
	});
});
