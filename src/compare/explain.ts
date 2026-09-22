/** Comparison explanations derived from the two immutable reports. */
import { type AuditReport, carriedAnalyses, SCORING_VERSION } from "../contract/index.ts";
import { SCORING_FORMULA } from "../scoring/formula.ts";
import { scoreSloppiness } from "../scoring/index.ts";
import type { FindingComparison } from "./diff.ts";

export interface DimensionChange {
	dimension: string;
	baselineExactPoints: number;
	currentExactPoints: number;
	deltaExactPoints: number;
	baselineRoundedPoints: number;
	currentRoundedPoints: number;
}

export interface DenominatorChange {
	metricId: string;
	baselineNumerator: number;
	currentNumerator: number;
	baselineDenominator: number;
	currentDenominator: number;
}

export interface SeverityChange {
	kind: string;
	path: string;
	ownerKey: string | null;
	field: string;
	baseline: number;
	current: number;
}

export interface ComparisonExplanation {
	/** Exact formula contributions only when both reports use this executable formula. */
	dimensionChanges: DimensionChange[];
	denominatorChanges: DenominatorChange[];
	persistentSeverityChanges: SeverityChange[];
	baselineSaturatedDensityTerms: string[];
	currentSaturatedDensityTerms: string[];
}

function sourceFiles(report: AuditReport): readonly { path: string; fingerprint: string }[] | null {
	const analysis = carriedAnalyses(report).find(
		(entry) => entry.provider.id === "trellis.complexity",
	);
	return analysis?.analysis?.selection.files ?? null;
}

export function sourceInputChange(
	baseline: AuditReport,
	current: AuditReport,
): "changed" | "unchanged" | "unknown" {
	const before = sourceFiles(baseline);
	const after = sourceFiles(current);
	if (before === null || after === null) return "unknown";
	return JSON.stringify(before) === JSON.stringify(after) ? "unchanged" : "changed";
}

function exactDimensions(baseline: AuditReport, current: AuditReport): DimensionChange[] {
	if (baseline.scoringVersion !== SCORING_VERSION || current.scoringVersion !== SCORING_VERSION)
		return [];
	const before = scoreSloppiness(Object.values(baseline.metrics));
	const after = scoreSloppiness(Object.values(current.metrics));
	if (before.index !== baseline.score.index || after.index !== current.score.index) return [];
	return before.dimensions.flatMap((dimension) => {
		const next = after.dimensions.find((entry) => entry.dimension === dimension.dimension);
		return next !== undefined &&
			dimension.exactPoints !== null &&
			next.exactPoints !== null &&
			dimension.points !== null &&
			next.points !== null
			? [
					{
						dimension: dimension.dimension,
						baselineExactPoints: dimension.exactPoints,
						currentExactPoints: next.exactPoints,
						deltaExactPoints: next.exactPoints - dimension.exactPoints,
						baselineRoundedPoints: dimension.points,
						currentRoundedPoints: next.points,
					},
				]
			: [];
	});
}

function changedDenominators(baseline: AuditReport, current: AuditReport): DenominatorChange[] {
	return Object.values(baseline.metrics)
		.flatMap((before) => {
			const after = current.metrics[before.id];
			return after !== undefined &&
				before.numerator !== undefined &&
				before.denominator !== undefined &&
				after.numerator !== undefined &&
				after.denominator !== undefined &&
				before.denominator !== after.denominator
				? [
						{
							metricId: before.id,
							baselineNumerator: before.numerator,
							currentNumerator: after.numerator,
							baselineDenominator: before.denominator,
							currentDenominator: after.denominator,
						},
					]
				: [];
		})
		.sort((a, b) => a.metricId.localeCompare(b.metricId));
}

const SEVERITY_FIELDS = ["cc", "mass", "maxNesting", "decisions", "contentLines", "words"];

function changedSeverity(findings: FindingComparison): SeverityChange[] {
	return findings.persistent
		.flatMap(({ baseline, current }) =>
			SEVERITY_FIELDS.flatMap((field) => {
				const before = baseline.facts?.[field];
				const after = current.facts?.[field];
				return typeof before === "number" && typeof after === "number" && before !== after
					? [
							{
								kind: current.kind,
								path: current.path,
								ownerKey:
									typeof current.facts?.ownerKey === "string" ? current.facts.ownerKey : null,
								field,
								baseline: before,
								current: after,
							},
						]
					: [];
			}),
		)
		.sort(
			(a, b) =>
				a.kind.localeCompare(b.kind) ||
				a.path.localeCompare(b.path) ||
				a.field.localeCompare(b.field),
		);
}

function saturatedDensityTerms(report: AuditReport): string[] {
	if (report.scoringVersion !== SCORING_FORMULA.version) return [];
	return SCORING_FORMULA.dimensions.flatMap((dimension) =>
		dimension.terms.flatMap((term) => {
			if (!("saturatesAt" in term)) return [];
			const value = report.metrics[term.metricId]?.value;
			return value !== undefined && value >= term.saturatesAt ? [term.metricId] : [];
		}),
	);
}

export function explainComparison(
	baseline: AuditReport,
	current: AuditReport,
	findings: FindingComparison,
): ComparisonExplanation {
	return {
		dimensionChanges: exactDimensions(baseline, current),
		denominatorChanges: changedDenominators(baseline, current),
		persistentSeverityChanges: changedSeverity(findings),
		baselineSaturatedDensityTerms: saturatedDensityTerms(baseline),
		currentSaturatedDensityTerms: saturatedDensityTerms(current),
	};
}
