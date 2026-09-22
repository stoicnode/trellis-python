#!/usr/bin/env bun
import { execFileSync, spawnSync } from "node:child_process";
/**
 * Read-only Phase 1 open-source benchmark harness.
 *
 * The frozen external repositories are deliberately outside this checkout.
 * This runner audits only committed, distilled fixtures through the public
 * `runWorkspaceAudit` service, and optionally verifies an operator-prepared
 * external checkout's pinned Git identities. It never fetches, installs, or
 * executes target-project code.
 */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { z } from "zod";
import { runWorkspaceAudit } from "../src/audit/index.ts";
import type { AuditReport } from "../src/contract/index.ts";
import { parsePython } from "../src/python/parser.ts";

const MEASUREMENT_SCRIPT = resolve(import.meta.dir, "oss-benchmark-measure.ts");

export const fixtureSchema = z.strictObject({
	id: z.string().min(1),
	path: z.string().min(1),
	snapshot: z.string(),
	maxMatchWork: z.number().int().positive().optional(),
});
const baselineSchema = z.strictObject({
	id: z.string().min(1),
	repository: z.string().min(1).optional(),
	path: z.string().min(1).optional(),
	index: z.number().int().min(0).max(100),
	completeness: z.enum(["complete", "incomplete"]),
	production: z.strictObject({
		files: z.number().int().nonnegative(),
		sloc: z.number().int().nonnegative(),
	}),
	parseFailures: z.number().int().nonnegative(),
	unresolvedReasons: z.record(z.string(), z.number().int().nonnegative()),
});
const manifestSchema = z.strictObject({
	version: z.literal(1),
	repositories: z.array(
		z.strictObject({
			id: z.string(),
			commit: z.string().regex(/^[0-9a-f]{40}$/),
			tree: z.string().regex(/^[0-9a-f]{40}$/),
		}),
	),
	baselines: z.array(baselineSchema),
	fixtures: z.array(fixtureSchema).length(5),
});
export type OssBenchmarkManifest = z.infer<typeof manifestSchema>;
export type OssBenchmarkFixture = z.infer<typeof fixtureSchema>;

export interface FixtureRecord {
	id: string;
	snapshot: { expected: string; actual: string; matches: boolean };
	completeness: AuditReport["completeness"];
	sourceCoverage: AuditReport["sourceCoverage"];
	metrics: Record<string, { state: string; value: number | null; reason?: string }>;
	scoreContributions: AuditReport["score"]["contributions"];
	unresolvedReasons: Record<string, number>;
	diagnostics: Array<{ path: string; codes: string[] }>;
	measurement: { durationMs: number; peakRssMb: number };
}
export interface OssBenchmarkRecord {
	fixtures: FixtureRecord[];
	ok: boolean;
}

export function loadOssBenchmarkManifest(root: string): OssBenchmarkManifest {
	return manifestSchema.parse(JSON.parse(requireText(resolve(root, "manifest.json"))));
}

function requireText(path: string): string {
	// Bun's synchronous file read keeps manifest loading deterministic and small.
	return readFileSync(path, "utf8");
}

async function files(root: string, current = root): Promise<string[]> {
	const entries = await readdir(current, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = resolve(current, entry.name);
			if (lstatSync(path).isSymbolicLink())
				throw new Error(`fixture snapshot rejects symlink: ${path}`);
			if (entry.isDirectory()) return files(root, path);
			return entry.isFile() ? [relative(root, path)] : [];
		}),
	);
	return nested.flat().sort();
}

export async function pythonDiagnostics(
	root: string,
): Promise<Array<{ path: string; codes: string[] }>> {
	const paths = (await files(root)).filter((path) => path.endsWith(".py"));
	return Promise.all(
		paths.map(async (path) => ({
			path,
			codes: parsePython(path, await readFile(resolve(root, path), "utf8")).diagnostics.map(
				(diagnostic) => diagnostic.code,
			),
		})),
	);
}

/** SHA-256 of sorted `path<TAB>file<TAB>file-sha256` lines. */
export async function fixtureSnapshot(root: string): Promise<string> {
	const lines = await Promise.all(
		(await files(root)).map(async (path) => {
			const bytes = await readFile(resolve(root, path));
			const digest = createHash("sha256").update(bytes).digest("hex");
			return `${path}\tfile\t${digest}\n`;
		}),
	);
	return createHash("sha256").update(lines.sort().join("")).digest("hex");
}

export function unresolvedReasons(report: AuditReport): Record<string, number> {
	const reasons: Record<string, number> = {};
	for (const finding of report.findings) {
		if (finding.kind !== "graph.unresolved-import") continue;
		const reason = finding.facts?.reason;
		if (typeof reason === "string") reasons[reason] = (reasons[reason] ?? 0) + 1;
	}
	return reasons;
}

/** Peak RSS in MiB for this fresh measurement process. */
export function peakRssMb(): number {
	const resourceUsage = process.resourceUsage?.();
	if (resourceUsage?.maxRSS !== undefined) return resourceUsage.maxRSS / 1024;
	try {
		const match = readFileSync("/proc/self/status", "utf8").match(/^VmHWM:\s+(\d+)\s*kB$/m);
		if (match?.[1] !== undefined) return Number.parseInt(match[1], 10) / 1024;
	} catch {
		// Hosts without resourceUsage or VmHWM fall back to current RSS below.
	}
	return process.memoryUsage().rss / (1024 * 1024);
}

/** Measure one fixture in a new Bun process so its peak RSS is not cumulative. */
export function measureFixtureInChildProcess(root: string, id: string): FixtureRecord {
	const result = spawnSync(process.execPath, [MEASUREMENT_SCRIPT, "fixture", root, id], {
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
	if (result.status !== 0)
		throw new Error(`fixture measurement child failed for ${id}: ${result.stderr.trim()}`);
	return JSON.parse(result.stdout) as FixtureRecord;
}

export function equalReasonCounts(
	left: Record<string, number>,
	right: Record<string, number>,
): boolean {
	const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
	return keys.every((key) => left[key] === right[key]);
}

/** Audit the committed fixtures with the same service folded by CLI and SDK. */
export async function runOssBenchmark(root: string): Promise<OssBenchmarkRecord> {
	const manifest = loadOssBenchmarkManifest(root);
	const fixtures = manifest.fixtures.map((fixture) =>
		measureFixtureInChildProcess(root, fixture.id),
	);
	return { fixtures, ok: fixtures.every((fixture) => fixture.snapshot.matches) };
}

/** Check an already-prepared external checkout without fetching or auditing it. */
/* c8 ignore start -- opt-in prepared-root paths are intentionally absent from normal offline tests. */
export function verifyPinnedRepositories(root: string, externalRoot: string): string[] {
	const manifest = loadOssBenchmarkManifest(root);
	return manifest.repositories.flatMap((repository) => {
		try {
			const checkout = resolve(externalRoot, repository.id);
			const actual = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
				encoding: "utf8",
			}).trim();
			const tree = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD^{tree}"], {
				encoding: "utf8",
			}).trim();
			const dirty = execFileSync("git", ["-C", checkout, "status", "--porcelain"], {
				encoding: "utf8",
			}).trim();
			return actual === repository.commit && tree === repository.tree && dirty === ""
				? []
				: [
						`${repository.id}: expected ${repository.commit}/${repository.tree} clean, got ${actual}/${tree}${dirty === "" ? "" : " dirty"}`,
					];
		} catch (error) {
			return [
				`${repository.id}: unavailable (${error instanceof Error ? error.message : String(error)})`,
			];
		}
	});
}

/**
 * Check prepared baseline artifacts against the frozen counts. A mismatch is
 * returned as evidence instead of silently revising the baseline. This is a
 * preparation-only check: normal fixture tests never require these files.
 */
export async function verifyBaselineArtifacts(
	root: string,
	artifactRoot: string,
): Promise<string[]> {
	const manifest = loadOssBenchmarkManifest(root);
	const names: Record<string, string> = { "tanstack-query": "tanstack-query" };
	const failures: string[] = [];
	for (const baseline of manifest.baselines) {
		const artifact = JSON.parse(
			await readFile(resolve(artifactRoot, `${names[baseline.id] ?? baseline.id}.json`), "utf8"),
		) as {
			completeness?: string;
			score?: { index?: number };
			sourceCoverage?: { production?: { files?: number; sloc?: number } };
			languageCoverage?: Array<{ parseFailureFiles?: number }>;
			findings?: Array<{ kind?: string; facts?: { reason?: string } }>;
		};
		const reasons: Record<string, number> = {};
		for (const finding of artifact.findings ?? []) {
			if (finding.kind === "graph.unresolved-import" && typeof finding.facts?.reason === "string") {
				const reason = finding.facts.reason;
				reasons[reason] = (reasons[reason] ?? 0) + 1;
			}
		}
		const parseFailures = (artifact.languageCoverage ?? []).reduce(
			(sum, row) => sum + (row.parseFailureFiles ?? 0),
			0,
		);
		const observed = {
			index: artifact.score?.index,
			completeness: artifact.completeness,
			files: artifact.sourceCoverage?.production?.files,
			sloc: artifact.sourceCoverage?.production?.sloc,
			parseFailures,
			reasons,
		};
		if (
			observed.index !== baseline.index ||
			observed.completeness !== baseline.completeness ||
			observed.files !== baseline.production.files ||
			observed.sloc !== baseline.production.sloc ||
			observed.parseFailures !== baseline.parseFailures ||
			!equalReasonCounts(observed.reasons, baseline.unresolvedReasons)
		) {
			failures.push(`${baseline.id}: baseline revision mismatch ${JSON.stringify(observed)}`);
		}
	}
	return failures;
}

/**
 * Re-audit operator-prepared pinned roots through the normal service and
 * return explicit count mismatches. This is opt-in because full snapshots
 * are intentionally outside the repository and may be expensive.
 */
export async function auditPinnedRepositories(
	root: string,
	externalRoot: string,
): Promise<{ records: unknown[]; mismatches: string[] }> {
	const integrity = verifyPinnedRepositories(root, externalRoot);
	if (integrity.length > 0) return { records: [], mismatches: integrity };
	const manifest = loadOssBenchmarkManifest(root);
	const measured = manifest.baselines.map((baseline) =>
		measurePinnedRepositoryInChildProcess(root, externalRoot, baseline.id),
	);
	return {
		records: measured.map((entry) => entry.record),
		mismatches: measured.flatMap((entry) => (entry.mismatch === undefined ? [] : [entry.mismatch])),
	};
}

interface PinnedRepositoryMeasurement {
	record: unknown;
	mismatch?: string;
}

function measurePinnedRepositoryInChildProcess(
	root: string,
	externalRoot: string,
	id: string,
): PinnedRepositoryMeasurement {
	const result = spawnSync(
		process.execPath,
		[MEASUREMENT_SCRIPT, "pinned", root, externalRoot, id],
		{ encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
	);
	if (result.status !== 0)
		throw new Error(`pinned measurement child failed for ${id}: ${result.stderr.trim()}`);
	return JSON.parse(result.stdout) as PinnedRepositoryMeasurement;
}

/** Post-fix Python acceptance is separate from the frozen historical baseline. */
export async function auditPostFixPython(root: string, externalRoot: string): Promise<unknown[]> {
	const integrity = verifyPinnedRepositories(root, externalRoot);
	if (integrity.length > 0) return integrity.map((failure) => ({ failure, ok: false }));
	const astEvidence = await import("./prepare-python-ast-parse.ts");
	const manifest = loadOssBenchmarkManifest(root);
	const evidence = astEvidence.loadCommittedPythonAstEvidence(root);
	const evidenceMismatches = astEvidence.pythonAstEvidenceMismatches(manifest, evidence);
	if (evidenceMismatches.length > 0)
		return evidenceMismatches.map((failure) => ({ failure, ok: false }));
	const expected = evidence.entries;
	return Promise.all(
		expected.map(async (entry) => {
			const result = await runWorkspaceAudit(resolve(externalRoot, entry.id), {
				now: new Date("2026-09-22T00:00:00.000Z"),
			});
			const report = result.report;
			const python = report.languageCoverage?.find((row) => row.language === "python");
			const parserDependentIncomplete = Object.values(report.metrics)
				.filter(
					(metric) =>
						(metric.id.startsWith("complexity.") || metric.id.startsWith("erosion.")) &&
						metric.state === "incomplete",
				)
				.map((metric) => metric.id);
			const unsupportedDuplication = Object.values(report.metrics)
				.filter(
					(metric) =>
						metric.id.startsWith("duplication.") &&
						metric.state === "incomplete" &&
						!metric.reason?.includes("match-work budget"),
				)
				.map((metric) => metric.id);
			return {
				id: entry.id,
				discoveredPythonFiles: python?.discoveredFiles,
				parseFailureFiles: python?.parseFailureFiles,
				parserDependentIncomplete,
				unsupportedDuplication,
				ok:
					python?.discoveredFiles === entry.files &&
					python?.parseFailureFiles === 0 &&
					parserDependentIncomplete.length === 0 &&
					unsupportedDuplication.length === 0,
			};
		}),
	);
}

/** Explicit preparation entry point; normal tests never call it or need Python/external inputs. */
export async function main(
	args: string[],
	write: (text: string) => void = console.log,
): Promise<number> {
	const preparedIndex = args.indexOf("--prepared-root");
	const artifactIndex = args.indexOf("--artifact-root");
	if (preparedIndex < 0 || artifactIndex < 0) {
		throw new Error("usage: --prepared-root <repos> --artifact-root <artifacts> [--reaudit]");
	}
	const preparedRoot = args[preparedIndex + 1];
	const artifactRoot = args[artifactIndex + 1];
	if (preparedRoot === undefined || artifactRoot === undefined)
		throw new Error("prepared roots need values");
	const root = resolve(import.meta.dir, "../corpus/oss-benchmark");
	const integrity = verifyPinnedRepositories(root, preparedRoot);
	const artifactMismatches = await verifyBaselineArtifacts(root, artifactRoot);
	const reAudit = args.includes("--reaudit")
		? await auditPinnedRepositories(root, preparedRoot)
		: undefined;
	const pythonAcceptance = args.includes("--python-acceptance")
		? await auditPostFixPython(root, preparedRoot)
		: undefined;
	write(
		`${JSON.stringify({
			repositories: loadOssBenchmarkManifest(root).baselines,
			integrity,
			artifactMismatches,
			...(reAudit === undefined ? {} : { reAudit }),
			...(pythonAcceptance === undefined ? {} : { pythonAcceptance }),
		})}\n`,
	);
	return integrity.length === 0 &&
		artifactMismatches.length === 0 &&
		(reAudit?.mismatches.length ?? 0) === 0 &&
		(pythonAcceptance?.every((entry) => (entry as { ok: boolean }).ok) ?? true)
		? 0
		: 1;
}

if (import.meta.main) main(process.argv.slice(2)).then((code) => (process.exitCode = code));
/* c8 ignore stop */
