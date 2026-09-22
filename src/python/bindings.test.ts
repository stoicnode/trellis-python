import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSourceInventory } from "../discovery/index.ts";
import { analyzeCycles } from "../metrics/analyze-cycles.ts";
import { analyzeDependencyGraph } from "../metrics/analyze-graph.ts";
import { buildSyntaxInventory } from "../syntax/index.ts";
import { collectPythonImportSites } from "./imports.ts";
import { parsePython } from "./parser.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-python-bindings-"));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(join(root, path, ".."), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

describe("Python binding-aware imports", () => {
	test("classifies confirmed typing guards and keeps their else branches eager", () => {
		const source = [
			"from typing import TYPE_CHECKING as TC",
			"import typing as t",
			"if TC:",
			"    from .typed import first",
			"    if t.TYPE_CHECKING:",
			"        from .nested import second",
			"else:",
			"    from .runtime import third",
			"if not TC:",
			"    from .runtime_again import fourth",
			"else:",
			"    from .typed_again import fifth",
		].join("\n");
		const parsed = parsePython("src/pkg/left.py", source);
		expect(parsed.diagnostics).toEqual([]);
		const sites = collectPythonImportSites(parsed.tree, source, "src/pkg/left.py");
		expect(sites.map((site) => [site.specifier, site.typeOnly])).toEqual([
			["typing", false],
			["typing", false],
			["typed", true],
			["nested", true],
			["runtime", false],
			["runtime_again", false],
			["typed_again", true],
		]);
	});

	test("does not infer type-only imports after aliases are rebound or shadowed", () => {
		const source = [
			"from typing import TYPE_CHECKING as TC",
			"TC = unknown",
			"if TC:",
			"    from .eager import value",
			"import typing as t",
			"def load(t):",
			"    if t.TYPE_CHECKING:",
			"        from .shadowed import value",
			"def later():",
			"    if TC:",
			"        from .rebound import value",
		].join("\n");
		const parsed = parsePython("src/pkg/left.py", source);
		expect(parsed.diagnostics).toEqual([]);
		const sites = collectPythonImportSites(parsed.tree, source, "src/pkg/left.py");
		expect(
			sites
				.filter(
					(site) =>
						site.specifier?.startsWith("eager") ||
						site.specifier?.startsWith("shadowed") ||
						site.specifier?.startsWith("rebound"),
				)
				.map((site) => site.typeOnly),
		).toEqual([false, false, false]);
	});

	test("does not treat deferred global guards as immutable after definition", () => {
		const source = [
			"from typing import TYPE_CHECKING as TC",
			"def later():",
			"    if TC:",
			"        from .possibly_runtime import value",
			"TC = runtime_flag",
			"def locally_confirmed():",
			"    from typing import TYPE_CHECKING as LocalTC",
			"    if LocalTC:",
			"        from .type_only import value",
		].join("\n");
		const parsed = parsePython("src/pkg/left.py", source);
		expect(parsed.diagnostics).toEqual([]);
		const sites = collectPythonImportSites(parsed.tree, source, "src/pkg/left.py");
		expect(sites.find((site) => site.specifier === "possibly_runtime")?.typeOnly).toBe(false);
		expect(sites.find((site) => site.specifier === "type_only")?.typeOnly).toBe(true);
	});

	test("keeps a typing-only and runtime pair out of runtime cycle groups", async () => {
		const root = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/left.py":
				"from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from .right import value\n",
			"src/pkg/right.py": "from .left import value\n",
		});
		const inventory = await discoverSourceInventory(root);
		const syntax = await buildSyntaxInventory(inventory);
		const graph = analyzeDependencyGraph(inventory, syntax);
		const cycles = analyzeCycles(graph);
		expect(graph.graph.edges.find((edge) => edge.specifier === "right")?.typeOnly).toBe(true);
		expect(cycles.groups).toEqual([]);
	});
});
