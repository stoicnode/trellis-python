#!/usr/bin/env bun
import { execFileSync, spawnSync } from "node:child_process";
/**
 * Reproducible, read-only measurements for operator-prepared Python scopes.
 *
 * The manifest is intentionally external to the repository. It identifies
 * clean, pinned checkouts and the repository-relative scopes to audit:
 * `{ version: 1, repositories: [{ id, commit, tree, scopes: [{ id, path }] }] }`.
 * No checkout is fetched, installed, or asked to execute project code.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import { runWorkspaceAudit } from "../src/audit/index.ts";
import type { AuditConfig, AuditReport, Finding } from "../src/contract/index.ts";
import { auditConfigSchema, measurementPayload } from "../src/contract/index.ts";

const sourceSchema = z.strictObject({
	exclude: z.array(z.string().min(1)).default([]),
	classify: z
		.record(
			z.string().min(1),
			z.enum(["production", "test", "generated", "vendored", "declaration-only"]),
		)
		.default({}),
});
const scopeSchema = z.strictObject({
	id: z.string().min(1),
	path: z.string().min(1),
	configPath: z.string().min(1).optional(),
	source: sourceSchema.optional(),
});
const repositorySchema = z.strictObject({
	id: z.string().min(1),
	remote: z.string().min(1).optional(),
	commit: z.string().regex(/^[0-9a-f]{40}$/),
	tree: z.string().regex(/^[0-9a-f]{40}$/),
	scopes: z.array(scopeSchema).min(1),
});
const manifestSchema = z.strictObject({
	version: z.literal(1),
	repositories: z.array(repositorySchema).min(1),
});
export type PythonCalibrationManifest = z.infer<typeof manifestSchema>;

export interface GitIdentity {
	commit: string;
	tree: string;
	clean: boolean;
	ignoredSourceFiles: string[];
}

export interface CalibrationRun {
	payloadFingerprint: string;
	analyzerVersion: string;
	schemaVersion: string;
	scoringVersion: string;
	completeness: AuditReport["completeness"];
	metrics: AuditReport["metrics"];
	sourceCoverage: AuditReport["sourceCoverage"];
	languageCoverage: AuditReport["languageCoverage"];
	score: AuditReport["score"];
	unresolvedReasons: Record<string, number>;
	hotspots: Finding[];
	cloneGroups: Finding[];
	findingCounts: Record<string, number>;
	configPath?: string;
	source?: AuditConfig["source"];
	measurement: { wallTimeMs: number; peakRssMb: number };
}

export interface CalibrationScopeResult {
	repository: string;
	remote?: string;
	scope: string;
	path: string;
	configPath?: string;
	source?: AuditConfig["source"];
	git: GitIdentity;
	runs: CalibrationRun[];
	deterministic: boolean;
	ok: boolean;
	measurementSummary: { medianWallTimeMs: number; maxWallTimeMs: number; maxPeakRssMb: number };
}

export interface CalibrationArtifact {
	version: 1;
	runsPerScope: number;
	generatedAt: string;
	ok: boolean;
	scopes: CalibrationScopeResult[];
}

/** Convert Node's platform-specific maxRSS units to MiB. */
export function rssToMb(maxRss: number, platform = process.platform): number {
	return platform === "darwin" ? maxRss / (1024 * 1024) : maxRss / 1024;
}

function loadManifest(path: string): PythonCalibrationManifest {
	return manifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function gitIdentity(root: string): GitIdentity {
	const git = (args: string[]): string =>
		execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
	return {
		commit: git(["rev-parse", "HEAD"]),
		tree: git(["rev-parse", "HEAD^{tree}"]),
		clean: git(["status", "--porcelain", "--untracked-files=all"]) === "",
		ignoredSourceFiles: git(["ls-files", "--others", "--ignored", "--exclude-standard"])
			.split("\n")
			.filter((path) => /\.(?:py|pyi|ts|tsx)$/.test(path))
			.sort(),
	};
}

function verifyRepository(root: string, expected: { commit: string; tree: string }): GitIdentity {
	const actual = gitIdentity(root);
	if (
		actual.commit !== expected.commit ||
		actual.tree !== expected.tree ||
		!actual.clean ||
		actual.ignoredSourceFiles.length > 0
	) {
		throw new Error(
			`repository ${root} is not the pinned clean checkout: expected ` +
				`${expected.commit}/${expected.tree}, got ${actual.commit}/${actual.tree}` +
				`${actual.clean ? "" : " (dirty)"}${
					actual.ignoredSourceFiles.length === 0
						? ""
						: ` (ignored source files: ${actual.ignoredSourceFiles.join(", ")})`
				}`,
		);
	}
	return actual;
}

function scopeRoot(
	preparedRoot: string,
	repository: { id: string },
	scope: { path: string },
): string {
	const repo = resolve(preparedRoot, repository.id);
	const root = resolve(repo, scope.path);
	const repoRelative = relative(repo, root);
	const escaped = repoRelative.startsWith("..") || isAbsolute(repoRelative);
	if (escaped) throw new Error(`scope ${scope.path} escapes repository ${repository.id}`);
	return root;
}

function peakRssMb(): number {
	const usage = process.resourceUsage?.();
	return usage?.maxRSS !== undefined
		? rssToMb(usage.maxRSS)
		: process.memoryUsage().rss / (1024 * 1024);
}

function unresolvedReasons(report: AuditReport): Record<string, number> {
	const reasons: Record<string, number> = {};
	for (const finding of report.findings) {
		if (finding.kind !== "graph.unresolved-import") continue;
		const reason = finding.facts?.reason;
		if (typeof reason === "string") reasons[reason] = (reasons[reason] ?? 0) + 1;
	}
	return reasons;
}

function evidence(findings: readonly Finding[], kind: string): Finding[] {
	return findings.filter((finding) => finding.kind === kind).slice(0, 25);
}

async function measure(
	root: string,
	configPath?: string,
	source?: AuditConfig["source"],
): Promise<CalibrationRun> {
	const started = performance.now();
	const report = (
		await runWorkspaceAudit(root, {
			now: new Date("2026-09-22T00:00:00.000Z"),
			...(configPath === undefined ? {} : { configPath }),
			...(source === undefined ? {} : { config: auditConfigSchema.parse({ source }) }),
		})
	).report;
	const payload = measurementPayload(report);
	return {
		payloadFingerprint: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
		analyzerVersion: report.analyzerVersion,
		schemaVersion: report.schemaVersion,
		scoringVersion: report.scoringVersion,
		completeness: report.completeness,
		metrics: report.metrics,
		sourceCoverage: report.sourceCoverage,
		languageCoverage: report.languageCoverage,
		score: report.score,
		unresolvedReasons: unresolvedReasons(report),
		hotspots: evidence(report.findings, "complexity.hotspot"),
		cloneGroups: report.findings
			.filter(
				(finding) =>
					finding.kind === "duplication.clone-group" || finding.kind === "duplication.clone-pair",
			)
			.slice(0, 25),
		findingCounts: report.findings.reduce<Record<string, number>>((counts, finding) => {
			counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
			return counts;
		}, {}),
		...(configPath === undefined ? {} : { configPath }),
		measurement: { wallTimeMs: performance.now() - started, peakRssMb: peakRssMb() },
	};
}

function childMeasurement(root: string, configPath?: string, sourceJson?: string): void {
	const source = sourceJson === undefined ? undefined : sourceSchema.parse(JSON.parse(sourceJson));
	measure(root, configPath, source)
		.then((run) => process.stdout.write(`${JSON.stringify(run)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}

function runChild(
	root: string,
	script: string,
	configPath?: string,
	source?: AuditConfig["source"],
): CalibrationRun {
	const child = spawnSync(
		process.execPath,
		[
			script,
			"--child",
			root,
			...(configPath ? ["--config", configPath] : []),
			...(source ? ["--source", JSON.stringify(source)] : []),
		],
		{
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		},
	);
	if (child.status !== 0) throw new Error(`measurement child failed: ${child.stderr.trim()}`);
	return JSON.parse(child.stdout) as CalibrationRun;
}

function collectScope(
	manifestPath: string,
	preparedRoot: string,
	repository: PythonCalibrationManifest["repositories"][number],
	scope: PythonCalibrationManifest["repositories"][number]["scopes"][number],
	runsPerScope: number,
	script: string,
): CalibrationScopeResult {
	const repoRoot = resolve(preparedRoot, repository.id);
	const root = scopeRoot(preparedRoot, repository, scope);
	const configPath =
		scope.configPath === undefined ? undefined : resolve(dirname(manifestPath), scope.configPath);
	const measured = Array.from({ length: runsPerScope }, () =>
		runChild(root, script, configPath, scope.source),
	);
	const after = verifyRepository(repoRoot, repository);
	const fingerprints = measured.map((run) => run.payloadFingerprint);
	const deterministic = fingerprints.every((fingerprint) => fingerprint === fingerprints[0]);
	const wallTimes = measured.map((run) => run.measurement.wallTimeMs).sort((a, b) => a - b);
	return {
		repository: repository.id,
		...(repository.remote === undefined ? {} : { remote: repository.remote }),
		scope: scope.id,
		path: scope.path,
		...(configPath === undefined ? {} : { configPath }),
		...(scope.source === undefined ? {} : { source: scope.source }),
		git: after,
		runs: measured,
		deterministic,
		ok: deterministic && after.clean && after.ignoredSourceFiles.length === 0,
		measurementSummary: {
			medianWallTimeMs: wallTimes[Math.floor(wallTimes.length / 2)] ?? 0,
			maxWallTimeMs: Math.max(...wallTimes),
			maxPeakRssMb: Math.max(...measured.map((run) => run.measurement.peakRssMb)),
		},
	};
}

export function collect(
	manifestPath: string,
	preparedRoot: string,
	runsPerScope: number,
	script = import.meta.path,
): CalibrationArtifact {
	if (!Number.isInteger(runsPerScope) || runsPerScope < 1)
		throw new Error("--runs must be a positive integer");
	const manifest = loadManifest(manifestPath);
	const scopes: CalibrationScopeResult[] = [];
	for (const repository of manifest.repositories) {
		verifyRepository(resolve(preparedRoot, repository.id), repository);
		for (const scope of repository.scopes)
			scopes.push(
				collectScope(manifestPath, preparedRoot, repository, scope, runsPerScope, script),
			);
	}
	return {
		version: 1,
		runsPerScope,
		generatedAt: new Date().toISOString(),
		ok: scopes.every((scope) => scope.ok),
		scopes,
	};
}

function argument(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index < 0 ? undefined : args[index + 1];
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	if (args[0] === "--child" && args[1] !== undefined)
		childMeasurement(
			resolve(args[1]),
			argument(args.slice(2), "--config"),
			argument(args.slice(2), "--source"),
		);
	else {
		const manifest = argument(args, "--manifest");
		const preparedRoot = argument(args, "--prepared-root");
		const out = argument(args, "--out");
		if (manifest === undefined || preparedRoot === undefined || out === undefined) {
			throw new Error(
				"usage: python-calibration-measure.ts --manifest <json> " +
					"--prepared-root <dir> --out <json> [--runs 3]",
			);
		}
		const artifact = collect(
			resolve(manifest),
			resolve(preparedRoot),
			Number(argument(args, "--runs") ?? "3"),
		);
		writeFileSync(resolve(out), `${JSON.stringify(artifact, null, 2)}\n`);
		process.exitCode = artifact.ok ? 0 : 2;
	}
}
