/** Post-fix repeatability evidence for pinned, operator-prepared benchmark scopes. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import type { AuditReport, Finding } from "../src/contract/index.ts";
import { loadOssBenchmarkManifest, verifyPinnedRepositories } from "./validate-oss-benchmarks.ts";

const MEASUREMENT_SCRIPT = resolve(import.meta.dir, "oss-benchmark-measure.ts");

/** A small, location-preserving slice of ranked measurement evidence. */
export interface PinnedFindingEvidence {
	kind: string;
	path: string;
	range: { start: number; end: number };
	summary: string;
}

/** One deterministic benchmark report with volatile run metadata excluded. */
export interface PinnedAcceptanceMeasurement {
	id: string;
	payloadFingerprint: string;
	summary: {
		completeness: AuditReport["completeness"];
		score: AuditReport["score"];
		sourceCoverage: AuditReport["sourceCoverage"];
		parseFailures: number;
		unresolvedReasons: Record<string, number>;
		incompleteMetrics: string[];
		hotspots: PinnedFindingEvidence[];
		cloneGroups: PinnedFindingEvidence[];
	};
	measurement: { durationMs: number; peakRssMb: number };
}

/** Three fresh runs and an evidence-backed repeatability verdict for one pinned scope. */
export interface PinnedAcceptanceEntry {
	id: string;
	runs: PinnedAcceptanceMeasurement[];
	repeatable: boolean;
	medianMs: number;
	peakRssMb: number;
	summary: PinnedAcceptanceMeasurement["summary"];
}

export interface PinnedAcceptanceRecord {
	runs: number;
	integrity: string[];
	entries: PinnedAcceptanceEntry[];
	ok: boolean;
}

/** Median of a non-empty measurement set, using upper-middle deterministically. */
export function median(values: readonly number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Turn a finding into bounded, source-location evidence for benchmark review. */
export function pinnedFindingEvidence(finding: Finding): PinnedFindingEvidence {
	return {
		kind: finding.kind,
		path: finding.path,
		range: { start: finding.range.start.line, end: finding.range.end.line },
		summary: finding.summary,
	};
}

/**
 * Re-run every pinned full and focused scope in fresh processes. The frozen
 * pre-fix baseline remains historical evidence; this acceptance records the
 * post-fix measurement and requires only input integrity plus repeatability.
 */
export async function auditPinnedAcceptance(
	root: string,
	externalRoot: string,
	runs = 3,
): Promise<PinnedAcceptanceRecord> {
	if (!Number.isInteger(runs) || runs < 1)
		throw new Error("acceptance runs must be a positive integer");
	const integrity = verifyPinnedRepositories(root, externalRoot);
	if (integrity.length > 0) return { runs, integrity, entries: [], ok: false };
	const manifest = loadOssBenchmarkManifest(root);
	const entries = manifest.baselines.map((baseline) => {
		const measured = Array.from({ length: runs }, () =>
			measurePinnedAcceptanceInChildProcess(root, externalRoot, baseline.id),
		);
		const first = measured[0];
		if (first === undefined) throw new Error(`no acceptance measurement for ${baseline.id}`);
		return {
			id: baseline.id,
			runs: measured,
			repeatable: measured.every(
				(measurement) => measurement.payloadFingerprint === first.payloadFingerprint,
			),
			medianMs: median(measured.map((measurement) => measurement.measurement.durationMs)),
			peakRssMb: Math.max(...measured.map((measurement) => measurement.measurement.peakRssMb)),
			summary: first.summary,
		};
	});
	return { runs, integrity, entries, ok: entries.every((entry) => entry.repeatable) };
}

function measurePinnedAcceptanceInChildProcess(
	root: string,
	externalRoot: string,
	id: string,
): PinnedAcceptanceMeasurement {
	const result = spawnSync(
		process.execPath,
		[MEASUREMENT_SCRIPT, "acceptance", root, externalRoot, id],
		{ encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
	);
	if (result.status !== 0)
		throw new Error(`pinned acceptance child failed for ${id}: ${result.stderr.trim()}`);
	return JSON.parse(result.stdout) as PinnedAcceptanceMeasurement;
}
