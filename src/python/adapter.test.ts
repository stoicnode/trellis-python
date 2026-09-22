import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { measuredSelection } from "../audit/providers.ts";
import { discoverSourceInventory } from "../discovery/index.ts";
import { analyzeCycles } from "../metrics/analyze-cycles.ts";
import { analyzeDependencyGraph } from "../metrics/analyze-graph.ts";
import { buildSyntaxInventory } from "../syntax/index.ts";
import { collectPythonImportSites } from "./imports.ts";
import { parsePython, pythonFunctions, pythonLineKinds, pythonTokens } from "./parser.ts";
import { createPythonGraphResolver } from "./resolve.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-python-adapter-"));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(join(root, path, ".."), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

function functions(source: string) {
	const parsed = parsePython("src/module.py", source);
	const lines = pythonLineKinds(parsed.tree, source);
	return {
		diagnostics: parsed.diagnostics,
		facts: pythonFunctions(parsed.tree, source, "production", lines.kinds),
	};
}

describe("Python structural adapter", () => {
	test("keeps a parenthesized relative import analyzable across comments", () => {
		const source = [
			"from .cookies import (",
			"    # Requests keeps imports readable.",
			"    CookieJar,",
			"    extract_cookies_to_jar,",
			")",
		].join("\n");
		const parsed = parsePython("src/requests/sessions.py", source);
		expect(parsed.diagnostics).toEqual([]);
		expect(collectPythonImportSites(parsed.tree, source, "src/requests/sessions.py")).toEqual([
			expect.objectContaining({
				python: { form: "from", level: 1, module: "cookies", imported: ["CookieJar"] },
			}),
			expect.objectContaining({
				python: {
					form: "from",
					level: 1,
					module: "cookies",
					imported: ["extract_cookies_to_jar"],
				},
			}),
		]);
	});

	test("accepts syntax recovered incorrectly by the upstream grammar", () => {
		const validSources = [
			"",
			"# a comment-only module\n# remains a module\n",
			[
				"from .cookies import (",
				"    # Requests keeps imports readable.",
				"    CookieJar,",
				"    extract_cookies_to_jar,",
				")",
			].join("\n"),
			"__all__ = (\n    'CookieJar',\n    'extract_cookies_to_jar',\n)\n",
			"def generator():\n    yield\n",
			"with connect() as (host, port):\n    use(host, port)\n",
			"values = [code for code, *parameters in controls]\n",
			[
				"match command:",
				"    case {'kind': 'copy', 'items': [first, *rest]}:",
				"        return first, rest",
			].join("\n"),
		];

		for (const source of validSources)
			expect(parsePython("src/valid.py", source).diagnostics).toEqual([]);
	});

	test("keeps malformed counterparts diagnosed", () => {
		const invalidSources = [
			"def broken():\nreturn 1\n",
			"if first:\n    value = 1\n  return value\n",
			"def generator():\n    yield from\n",
			"with connect() as (1, port):\n    use(port)\n",
			"values = [code for code, * in controls]\n",
			"from module import (\n    value\n",
		];

		for (const source of invalidSources)
			expect(parsePython("src/invalid.py", source).diagnostics.length).toBeGreaterThan(0);
	});

	test.each([
		["if and elif", "if x:\n        pass\n    elif x > 2:\n        pass", 3, 1],
		["nested if", "if x:\n        if x > 2:\n            pass", 3, 2],
		["for and while", "for y in x:\n        while y:\n            y -= 1", 3, 2],
		[
			"except handlers",
			"try:\n        x()\n    except ValueError:\n        pass\n    except OSError:\n        pass",
			3,
			1,
		],
		[
			"match default",
			"match x:\n        case 1:\n            return 1\n        case _:\n            return 0",
			2,
			1,
		],
		["comprehension and boolean", "return [i for i in x if i > 0 and i < 4]", 4, 0],
	] as const)("counts %s decisions and nesting", (_name, body, cc, maxNesting) => {
		const result = functions(`def inspect(x):\n    ${body}\n`);
		expect(result.diagnostics).toEqual([]);
		expect(result.facts[0]?.complexity).toEqual({ cc, maxNesting });
	});

	test("inventories async, decorated, static and nested functions with lexical identities", () => {
		const source = [
			"class Store:",
			"    @staticmethod",
			"    def fetch(value):",
			"        def nested(item):",
			"            return item if item else value",
			"        return nested(value)",
			"async def fetch(value):",
			"    return value",
			"",
		].join("\n");
		const result = functions(source);
		expect(result.diagnostics).toEqual([]);
		expect(result.facts.map((fact) => fact.name)).toEqual(["fetch", "nested", "fetch"]);
		expect(result.facts[0]?.identity).toMatchObject({
			state: "identified",
			function: { member: "static" },
		});
		expect(result.facts[1]?.parentIndex).toBe(0);
		expect(result.facts[0]?.complexity?.cc).toBe(1);
		expect(result.facts[1]?.complexity?.cc).toBe(2);
	});

	test("accounts for lambda decisions in a separate anonymous function", () => {
		const result = functions(
			"def outer(x):\n    choose = lambda y: y if y else x\n    return choose(x)\n",
		);
		expect(result.facts.map((fact) => fact.complexity?.cc)).toEqual([1, 2]);
		expect(result.facts[1]?.identity).toMatchObject({ state: "ambiguous", reason: "anonymous" });
	});

	test("accepts inline suites while rejecting a missing indented suite", () => {
		expect(functions("def choose(x):\n    if x: return 1\n    return 0\n").diagnostics).toEqual([]);
		expect(
			functions("def broken(x):\n    if x:\n    return 1\n").diagnostics.some(
				(d) => d.code === "PY-INDENT",
			),
		).toBe(true);
	});

	test("keeps Python clone tokens disjoint from TypeScript and preserves suite structure", () => {
		const source = "def a(x):\n    return x\n";
		const parsed = parsePython("a.py", source);
		const tokens = pythonTokens(parsed.tree, source);
		expect(tokens.length).toBeGreaterThan(0);
		expect(tokens.every((token) => token.kind > 1000)).toBe(true);
		expect(tokens.some((token) => token.kind === 0x3fffffff)).toBe(true);
	});
});

describe("Python import adapter", () => {
	test("counts only leading relative markers and preserves imported source sites", () => {
		const source = ["from pygments.style import Style", "from ...pkg import value"].join("\n");
		const parsed = parsePython("src/pkg/module.py", source);
		expect(parsed.diagnostics).toEqual([]);
		expect(collectPythonImportSites(parsed.tree, source, "src/pkg/module.py")).toEqual([
			expect.objectContaining({
				specifier: "pygments.style",
				range: {
					start: { line: 1, column: 6 },
					end: { line: 1, column: 20 },
				},
				python: { form: "from", level: 0, module: "pygments.style", imported: ["Style"] },
			}),
			expect.objectContaining({
				specifier: "pkg",
				range: {
					start: { line: 2, column: 9 },
					end: { line: 2, column: 12 },
				},
				python: { form: "from", level: 3, module: "pkg", imported: ["value"] },
			}),
		]);
	});

	test("keeps a valid local relative cycle complete", async () => {
		const root = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/left.py": "from .right import value\n",
			"src/pkg/right.py": "from .left import value\n",
		});
		const inventory = await discoverSourceInventory(root);
		const syntax = await buildSyntaxInventory(inventory);
		expect(syntax.files.flatMap((file) => file.diagnostics)).toEqual([]);
		const analysis = analyzeCycles(analyzeDependencyGraph(inventory, syntax));
		expect(analysis.groups).toEqual([
			expect.objectContaining({
				members: ["src/pkg/left.py", "src/pkg/right.py"],
				representativePath: ["src/pkg/left.py", "src/pkg/right.py", "src/pkg/left.py"],
			}),
		]);
		expect(analysis.metrics.find((metric) => metric.id === "import-cycle.groups")).toMatchObject({
			state: "complete",
			value: 1,
		});
	});

	test("distinguishes external dotted modules, package symbols, and missing local children", async () => {
		const source = [
			"from pygments.style import Style",
			"from pkg import exported_symbol",
			"from pkg.missing import value",
		].join("\n");
		const root = await workspace({
			"src/pkg/__init__.py": "exported_symbol = 1\n",
			"src/pkg/main.py": source,
		});
		const inventory = await discoverSourceInventory(root);
		const sites = collectPythonImportSites(
			parsePython("src/pkg/main.py", source).tree,
			source,
			"src/pkg/main.py",
		);
		const resolver = createPythonGraphResolver(inventory);
		expect(sites.map((site) => resolver.resolve("src/pkg/main.py", site))).toEqual([
			{ status: "external", packageName: "pygments" },
			{ status: "local", target: "src/pkg/__init__.py" },
			expect.objectContaining({ status: "unresolved", reason: "no-target" }),
		]);
	});

	test("extracts and resolves project, package, relative, external, missing and dynamic imports", async () => {
		const source = [
			"import pkg.b as sibling, os",
			"from . import b",
			"from pkg import b",
			"from pkg import symbol",
			"import pkg.missing",
			"from .. import outside",
			"from importlib import import_module as imod",
			"imod(name)",
			"__import__(name)",
			"",
		].join("\n");
		const root = await workspace({
			"pyproject.toml": "[project]\nname = 'sample'\n",
			"src/pkg/__init__.py": "",
			"src/pkg/a.py": source,
			"src/pkg/b.py": "from .a import thing\n",
			"src/main.ts": "export const value = 1;\n",
		});
		const inventory = await discoverSourceInventory(root);
		const resolver = createPythonGraphResolver(inventory);
		const parsed = parsePython("src/pkg/a.py", source);
		expect(parsed.diagnostics).toEqual([]);
		const sites = collectPythonImportSites(parsed.tree, source, "src/pkg/a.py");
		const results = sites.map((site) => resolver.resolve("src/pkg/a.py", site));
		expect(results.slice(0, 4)).toEqual([
			{ status: "local", target: "src/pkg/b.py" },
			{ status: "external", packageName: "os" },
			{ status: "local", target: "src/pkg/b.py" },
			{ status: "local", target: "src/pkg/b.py" },
		]);
		expect(results[4]).toEqual({ status: "local", target: "src/pkg/__init__.py" });
		expect(results[5]).toMatchObject({ status: "unresolved", reason: "no-target" });
		expect(results[6]).toMatchObject({ status: "unresolved", reason: "no-target" });
		expect(results[7]).toEqual({ status: "external", packageName: "importlib" });
		expect(results.slice(8)).toEqual([
			expect.objectContaining({ status: "unresolved", reason: "non-literal-dynamic" }),
			expect.objectContaining({ status: "unresolved", reason: "non-literal-dynamic" }),
		]);
		expect(measuredSelection(inventory).map((file) => file.path)).toEqual(["src/main.ts"]);
	});

	test("marks colliding root and src module names ambiguous", async () => {
		const root = await workspace({
			"pkg.py": "value = 1\n",
			"src/pkg.py": "value = 2\n",
			"main.py": "import pkg\n",
		});
		const inventory = await discoverSourceInventory(root);
		const resolver = createPythonGraphResolver(inventory);
		const source = "import pkg\n";
		const site = collectPythonImportSites(
			parsePython("main.py", source).tree,
			source,
			"main.py",
		)[0];
		if (site === undefined) throw new Error("expected import site");
		expect(resolver.resolve("main.py", site)).toMatchObject({
			status: "unresolved",
			reason: "ambiguous",
		});
	});

	test("resolves each member of a comma-separated relative import", async () => {
		const source = "from . import left as l, right\n";
		const root = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/main.py": source,
			"src/pkg/left.py": "value = 1\n",
			"src/pkg/right.py": "value = 2\n",
		});
		const inventory = await discoverSourceInventory(root);
		const resolver = createPythonGraphResolver(inventory);
		const sites = collectPythonImportSites(
			parsePython("src/pkg/main.py", source).tree,
			source,
			"src/pkg/main.py",
		);
		expect(sites.map((site) => resolver.resolve("src/pkg/main.py", site))).toEqual([
			{ status: "local", target: "src/pkg/left.py" },
			{ status: "local", target: "src/pkg/right.py" },
		]);
	});
});
