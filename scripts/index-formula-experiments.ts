#!/usr/bin/env bun
/** Read-only, pinned-corpus research runner. Never participates in audits. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import yaml from "js-yaml";
import { auditConfigSchema, type MetricValue } from "../src/contract/index.ts";
import { discoverSourceInventory } from "../src/discovery/index.ts";
import { analyzeComplexity } from "../src/metrics/analyze.ts";
import { analyzeDependencyGraph } from "../src/metrics/analyze-graph.ts";
import type { DependencyGraph, GraphEdge } from "../src/metrics/graph-types.ts";
import {
	EXPERIMENT_IDS,
	measureCandidateSignals,
	scoreExperiment,
} from "../src/research/formula-candidates.ts";
import { buildSyntaxInventory } from "../src/syntax/index.ts";
import type {
	CalibrationArtifact,
	PythonCalibrationManifest,
} from "./python-calibration-measure.ts";

type Scope = PythonCalibrationManifest["repositories"][number]["scopes"][number];
type Repo = PythonCalibrationManifest["repositories"][number];

function argument(args: string[], name: string): string {
	const index = args.indexOf(name);
	const value = index < 0 ? undefined : args[index + 1];
	if (value === undefined) throw new Error(`missing ${name}`);
	return resolve(value);
}

function git(root: string, args: string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function verifyRepo(root: string, repo: Repo): void {
	if (git(root, ["rev-parse", "HEAD"]) !== repo.commit)
		throw new Error(`${repo.id}: commit changed`);
	if (git(root, ["rev-parse", "HEAD^{tree}"]) !== repo.tree)
		throw new Error(`${repo.id}: tree changed`);
	if (git(root, ["status", "--porcelain", "--untracked-files=all"]) !== "")
		throw new Error(`${repo.id}: working tree is dirty`);
	if (
		git(root, ["ls-files", "--others", "--ignored", "--exclude-standard"])
			.split("\n")
			.some((path) => /\.(py|pyi|ts|tsx)$/.test(path))
	)
		throw new Error(`${repo.id}: ignored source files present`);
}

function scopeRoot(preparedRoot: string, repo: Repo, scope: Scope): string {
	const root = resolve(preparedRoot, repo.id);
	const scoped = resolve(root, scope.path);
	const within = relative(root, scoped);
	if (within.startsWith("..") || isAbsolute(within))
		throw new Error(`${scope.id}: path escapes pin`);
	return scoped;
}

function readMeasurements(path: string): CalibrationArtifact {
	const bytes = readFileSync(path);
	const decoded = path.endsWith(".gz") ? gunzipSync(bytes) : bytes;
	return JSON.parse(decoded.toString("utf8")) as CalibrationArtifact;
}

function metricsFor(
	run: CalibrationArtifact["scopes"][number]["runs"][number],
): Record<string, MetricValue> {
	return run.metrics;
}

function scopeConfig(manifestPath: string, scope: Scope) {
	if (scope.configPath === undefined)
		return auditConfigSchema.parse(scope.source === undefined ? {} : { source: scope.source });
	return auditConfigSchema.parse(
		yaml.load(readFileSync(resolve(dirname(manifestPath), scope.configPath), "utf8")),
	);
}

function localProductionEdge(edge: GraphEdge, production: ReadonlySet<string>) {
	if (edge.resolution.status !== "local") return [];
	if (!production.has(edge.from) || !production.has(edge.resolution.target)) return [];
	return [
		{
			from: edge.from,
			to: edge.resolution.target,
			edgeClass: edge.typeOnly ? ("type-only" as const) : ("runtime" as const),
		},
	];
}

function productionGraph(graph: DependencyGraph) {
	const nodes = new Set(
		graph.nodes.filter((node) => node.sourceSet === "production").map((node) => node.path),
	);
	return { nodes, edges: graph.edges.flatMap((edge) => localProductionEdge(edge, nodes)) };
}

function selectedRawMetrics(metrics: Readonly<Record<string, MetricValue>>) {
	return Object.fromEntries(
		Object.entries(metrics)
			.filter(
				([id]) =>
					/^(erosion\.|duplication\.|import-cycle\.|complexity\.)/.test(id) &&
					id.endsWith(".production"),
			)
			.map(([id, metric]) => [id, { state: metric.state, value: metric.value ?? null }]),
	);
}

async function measureScope(
	manifestPath: string,
	preparedRoot: string,
	repo: Repo,
	scope: Scope,
	previous: CalibrationArtifact["scopes"][number],
) {
	const root = scopeRoot(preparedRoot, repo, scope);
	const started = performance.now();
	const config = scopeConfig(manifestPath, scope);
	const source = await discoverSourceInventory(root, { source: config.source });
	const syntax = await buildSyntaxInventory(source);
	const functions = analyzeComplexity(syntax).functions.filter(
		(fn) => fn.sourceSet === "production",
	);
	const graph = analyzeDependencyGraph(source, syntax).graph;
	const production = productionGraph(graph);
	const signals = measureCandidateSignals(
		[...production.nodes].sort(),
		production.edges,
		functions.map((fn) => ({ cc: fn.cc, executableSloc: fn.sloc })),
	);
	const run = previous.runs[0];
	if (run === undefined) throw new Error(`${scope.id}: missing prior measurement`);
	const metrics = metricsFor(run);
	const scores = Object.fromEntries(
		EXPERIMENT_IDS.map((id) => [id, scoreExperiment(metrics, signals, id)]),
	);
	if (scores.authoritative?.index !== run.score.index)
		throw new Error(`${scope.id}: research baseline diverged from authoritative score`);
	const raw = selectedRawMetrics(metrics);
	return {
		id: scope.id,
		repository: repo.id,
		language: run.languageCoverage?.map((entry) => entry.language) ?? [],
		productionFiles: production.nodes.size,
		productionSloc: metrics["complexity.executable-sloc.production"]?.value ?? null,
		raw,
		signals,
		scores,
		measurement: {
			wallTimeMs: performance.now() - started,
			peakRssMb:
				process.resourceUsage().maxRSS / (process.platform === "darwin" ? 1024 * 1024 : 1024),
		},
	};
}

type MeasuredScope = Awaited<ReturnType<typeof measureScope>>;

function scoreDifference(a: MeasuredScope, b: MeasuredScope, experiment: string): number | null {
	const left = a.scores[experiment]?.exactIndex;
	const right = b.scores[experiment]?.exactIndex;
	return left === null || left === undefined || right === null || right === undefined
		? null
		: left - right;
}

function rankReversals(scopes: readonly MeasuredScope[], experiment: string): number {
	let reversals = 0;
	for (let left = 0; left < scopes.length; left += 1) {
		for (let right = left + 1; right < scopes.length; right += 1) {
			const a = scopes[left];
			const b = scopes[right];
			if (a === undefined || b === undefined) continue;
			const oldDifference = scoreDifference(a, b, "authoritative");
			const newDifference = scoreDifference(a, b, experiment);
			if (oldDifference !== null && newDifference !== null && oldDifference * newDifference < 0)
				reversals += 1;
		}
	}
	return reversals;
}

function summarize(scopes: readonly MeasuredScope[]) {
	const mean = (values: number[]): number | null =>
		values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
	const groups = {
		python: scopes.filter((scope) => scope.language?.includes("python")),
		typescript: scopes.filter((scope) => scope.language?.includes("typescript")),
		small: scopes.filter((scope) => (scope.productionSloc ?? 0) <= 5000),
		medium: scopes.filter(
			(scope) => (scope.productionSloc ?? 0) > 5000 && (scope.productionSloc ?? 0) <= 10000,
		),
		large: scopes.filter((scope) => (scope.productionSloc ?? 0) > 10000),
	};
	const experiments = Object.fromEntries(
		EXPERIMENT_IDS.map((id) => [
			id,
			{
				meanIndex: mean(scopes.flatMap((scope) => scope.scores[id]?.index ?? [])),
				meanExactIndex: mean(scopes.flatMap((scope) => scope.scores[id]?.exactIndex ?? [])),
				rankReversals: rankReversals(scopes, id),
				bySlice: Object.fromEntries(
					Object.entries(groups).map(([name, rows]) => [
						name,
						{
							count: rows.length,
							meanIndex: mean(rows.flatMap((scope) => scope.scores[id]?.index ?? [])),
						},
					]),
				),
			},
		]),
	);
	const saturated = Object.fromEntries(
		(
			[
				["erosion.eroded-share.production", 0.25],
				["duplication.density.production", 0.15],
				["import-cycle.density.production", 0.1],
			] as const
		).map(([id, cap]) => [id, scopes.filter((scope) => (scope.raw[id]?.value ?? 0) >= cap).length]),
	);
	return {
		experiments,
		saturatedAtCurrentCaps: saturated,
		wallTimeMs: scopes.reduce((sum, scope) => sum + scope.measurement.wallTimeMs, 0),
		maxObservedProcessRssMb: Math.max(...scopes.map((scope) => scope.measurement.peakRssMb)),
	};
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const manifestPath = argument(args, "--manifest");
	const preparedRoot = argument(args, "--prepared-root");
	const measurementsPath = argument(args, "--measurements");
	const outputPath = argument(args, "--out");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PythonCalibrationManifest;
	const previous = readMeasurements(measurementsPath);
	if (!previous.ok || previous.runsPerScope !== 3)
		throw new Error("prior corpus artifact is not a complete three-run record");
	const scopes = [];
	for (const repo of manifest.repositories) {
		const root = resolve(preparedRoot, repo.id);
		verifyRepo(root, repo);
		for (const scope of repo.scopes) {
			const measured = previous.scopes.find(
				(row) => row.repository === repo.id && row.scope === scope.id,
			);
			if (measured === undefined || !measured.ok)
				throw new Error(`${scope.id}: prior scope unavailable`);
			scopes.push(await measureScope(manifestPath, preparedRoot, repo, scope, measured));
		}
		verifyRepo(root, repo);
	}
	const inputHash = createHash("sha256").update(readFileSync(measurementsPath)).digest("hex");
	writeFileSync(
		outputPath,
		`${JSON.stringify({ version: 1, manifest: "corpus/index-utility/manifest.json", priorMeasurementsSha256: inputHash, experiments: EXPERIMENT_IDS, summary: summarize(scopes), scopes }, null, 2)}\n`,
	);
}

if (import.meta.main)
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
