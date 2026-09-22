/** Pure extraction and comparison of frozen, pre-remediation benchmark artifacts. */
import type { OssBenchmarkManifest } from "./validate-oss-benchmarks.ts";

type FrozenBaseline = OssBenchmarkManifest["baselines"][number];

/** The fields read from historical report JSON; missing fields remain visible as mismatches. */
export interface FrozenArtifact {
	completeness?: string;
	score?: { index?: number };
	sourceCoverage?: { production?: { files?: number; sloc?: number } };
	languageCoverage?: Array<{ parseFailureFiles?: number }>;
	findings?: Array<{ kind?: string; facts?: { reason?: string } }>;
}

export interface BaselineObservation {
	index: number | undefined;
	completeness: string | undefined;
	files: number | undefined;
	sloc: number | undefined;
	parseFailures: number;
	reasons: Record<string, number>;
}

export function equalReasonCounts(
	left: Record<string, number>,
	right: Record<string, number>,
): boolean {
	const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
	return keys.every((key) => left[key] === right[key]);
}

/** Preserve absent fields instead of silently filling a baseline value. */
export function observeBaselineArtifact(artifact: FrozenArtifact): BaselineObservation {
	const reasons: Record<string, number> = {};
	for (const finding of artifact.findings ?? []) {
		if (finding.kind !== "graph.unresolved-import") continue;
		const reason = finding.facts?.reason;
		if (typeof reason === "string") reasons[reason] = (reasons[reason] ?? 0) + 1;
	}
	return {
		index: artifact.score?.index,
		completeness: artifact.completeness,
		files: artifact.sourceCoverage?.production?.files,
		sloc: artifact.sourceCoverage?.production?.sloc,
		parseFailures: (artifact.languageCoverage ?? []).reduce(
			(sum, row) => sum + (row.parseFailureFiles ?? 0),
			0,
		),
		reasons,
	};
}

/** A historical baseline is frozen evidence, so every recorded count must match. */
export function differsFromFrozenBaseline(
	baseline: FrozenBaseline,
	observed: BaselineObservation,
): boolean {
	return (
		observed.index !== baseline.index ||
		observed.completeness !== baseline.completeness ||
		observed.files !== baseline.production.files ||
		observed.sloc !== baseline.production.sloc ||
		observed.parseFailures !== baseline.parseFailures ||
		!equalReasonCounts(observed.reasons, baseline.unresolvedReasons)
	);
}
