import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "../audit/index.ts";
import { audit as sdkAudit } from "../client/index.ts";
import { compareReports } from "../compare/compare.ts";
import { assessPolicy } from "../compare/policy.ts";
import { auditReportSchema, measurementPayload } from "../contract/index.ts";
import { discoverSourceInventory } from "../discovery/index.ts";
import { analyzeCycles } from "../metrics/analyze-cycles.ts";
import { analyzeDependencyGraph } from "../metrics/analyze-graph.ts";
import { buildSyntaxInventory } from "../syntax/index.ts";
import { collectPythonImportSites } from "./imports.ts";
import { parsePython } from "./parser.ts";
import { createPythonGraphResolver } from "./resolve.ts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "trellis-python-dynamic-"));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(join(root, path, ".."), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

function sites(source: string) {
	const parsed = parsePython("src/pkg/left.py", source);
	expect(parsed.diagnostics).toEqual([]);
	return collectPythonImportSites(parsed.tree, source, "src/pkg/left.py");
}

describe("Python literal dynamic imports", () => {
	test("retains a cycle after replacing a static import with a literal dynamic call", async () => {
		const right = "from .left import value\n";
		const staticRoot = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/left.py": "from .right import value\n",
			"src/pkg/right.py": right,
		});
		const dynamicRoot = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/left.py":
				"import importlib as il\nvalue = il.import_module('.right', package='pkg')\n",
			"src/pkg/right.py": right,
		});
		const measure = async (root: string) => {
			const inventory = await discoverSourceInventory(root);
			const syntax = await buildSyntaxInventory(inventory);
			const graph = analyzeDependencyGraph(inventory, syntax);
			return { graph, cycles: analyzeCycles(graph) };
		};
		const before = await measure(staticRoot);
		const after = await measure(dynamicRoot);
		expect(after.graph.graph.edges.find((edge) => edge.specifier === ".right")).toMatchObject({
			kind: "dynamic",
			resolution: { status: "local", target: "src/pkg/right.py" },
		});
		expect(
			after.cycles.metrics.find((metric) => metric.id === "import-cycle.groups.production")?.value,
		).toBe(
			before.cycles.metrics.find((metric) => metric.id === "import-cycle.groups.production")?.value,
		);
		expect(after.cycles.productionGroups).toHaveLength(1);
	});

	test("resolves aliases and absolute builtins while locating unsupported forms", async () => {
		const root = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/left.py": "",
			"src/pkg/right.py": "value = 1\n",
		});
		const source = [
			"from importlib import import_module as load",
			"load('pkg.right')",
			"__import__('pkg.right')",
			"load(module_name)",
			"__import__('.right')",
			"__import__('pkg.right', fromlist=['value'])",
			"load('pkg\\u002eright')",
		].join("\n");
		const resolver = createPythonGraphResolver(await discoverSourceInventory(root));
		const dynamic = sites(source).filter((site) => site.kind === "dynamic");
		expect(dynamic.map((site) => site.specifier)).toEqual([
			"pkg.right",
			"pkg.right",
			null,
			null,
			null,
			null,
		]);
		expect(dynamic.map((site) => resolver.resolve("src/pkg/left.py", site))).toEqual([
			{ status: "local", target: "src/pkg/right.py" },
			{ status: "local", target: "src/pkg/right.py" },
			...Array.from({ length: 4 }, () =>
				expect.objectContaining({ status: "unresolved", reason: "non-literal-dynamic" }),
			),
		]);
	});

	test("never fabricates an edge from a rebound alias or ambiguous owner", async () => {
		const root = await workspace({
			"pkg.py": "value = 1\n",
			"src/pkg.py": "value = 2\n",
			"src/pkg/left.py": "",
		});
		const source = [
			"from importlib import import_module as load",
			"load = other",
			"load('pkg')",
			"__import__('pkg')",
		].join("\n");
		const dynamic = sites(source).filter((site) => site.kind === "dynamic");
		expect(dynamic).toHaveLength(1);
		const site = dynamic[0];
		if (site === undefined) throw new Error("expected supported builtin import");
		expect(
			createPythonGraphResolver(await discoverSourceInventory(root)).resolve(
				"src/pkg/left.py",
				site,
			),
		).toMatchObject({
			status: "unresolved",
			reason: "ambiguous",
		});
	});

	test("retains deferred, conditional and typing context on Python edges", () => {
		const source = [
			"from typing import TYPE_CHECKING",
			"import importlib",
			"from .right import value",
			"if TYPE_CHECKING:",
			"    from .right import TypeValue",
			"def load(flag):",
			"    if flag:",
			"        return importlib.import_module('pkg.right')",
		].join("\n");
		const imports = sites(source);
		expect(imports.find((site) => site.specifier === "right" && !site.typeOnly)?.execution).toEqual(
			{ deferred: false, conditional: false },
		);
		expect(imports.find((site) => site.specifier === "right" && site.typeOnly)).toMatchObject({
			execution: { deferred: false, conditional: true },
		});
		expect(imports.find((site) => site.specifier === "pkg.right")?.execution).toEqual({
			deferred: true,
			conditional: true,
		});
	});

	test("surfaces variable conversion when the headline falls and gates observation coverage", async () => {
		const root = await workspace({
			"src/pkg/__init__.py": "",
			"src/pkg/left.py": "from .right import value\n",
			"src/pkg/right.py": "from .left import value\n",
		});
		const before = await auditWorkspace(root);
		await writeFile(
			join(root, "src/pkg/left.py"),
			"import importlib\nvalue = importlib.import_module(module_name)\n",
		);
		const after = await auditWorkspace(root);
		expect(after.score.index).toBeLessThan(before.score.index ?? 0);
		expect(after.metrics["graph.observation.dynamic.unresolved.production"]?.value).toBe(1);
		expect(after.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "graph.unresolved-import", path: "src/pkg/left.py" }),
			]),
		);
		const comparison = compareReports(before, after);
		expect(comparison.compatibility.comparable).toBe(true);
		expect(
			comparison.metrics?.find(
				(metric) => metric.id === "graph.observation.dynamic.unresolved.production",
			)?.delta,
		).toBe(1);
		const policy = {
			budgets: { "graph.observation.dynamic.unresolved.production": { max: 0 } },
			failOnNew: [],
			requireEvidence: [],
		};
		expect(assessPolicy(after, policy).results[0]).toMatchObject({
			status: "fail",
			reasons: [{ code: "budget-exceeded" }],
		});
		const sdk = await sdkAudit(root, {
			config: { source: { exclude: [], classify: {} }, providers: {}, policy },
		});
		expect(sdk.policy.failed).toBe(true);
		expect(sdk.report.metrics["graph.observation.dynamic.unresolved.production"]?.value).toBe(1);
		await writeFile(
			join(root, "trellis.yaml"),
			"policy:\n  budgets:\n    graph.observation.dynamic.unresolved.production:\n      max: 0\n",
		);
		const child = Bun.spawn(
			[process.execPath, join(import.meta.dir, "../cli/main.ts"), "audit", root, "--json"],
			{
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
		expect(code).toBe(2);
		expect(measurementPayload(auditReportSchema.parse(JSON.parse(stdout)))).toEqual(
			measurementPayload(sdk.report),
		);
	});
});
