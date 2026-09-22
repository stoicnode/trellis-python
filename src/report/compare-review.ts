/** Explain score movement and hidden raw changes from core comparison facts. */
import type { ReportComparison } from "../compare/index.ts";
import { formatNumber } from "./audit-format.ts";

function signed(value: number): string {
	return value > 0 ? `+${exact(value)}` : exact(value);
}

function exact(value: number): string {
	return String(Number(value.toFixed(9)));
}

function sourceLine(comparison: ReportComparison): string {
	switch (comparison.sourceInput) {
		case "changed":
			return "Native source snapshot changed; the reports measure different target content.";
		case "unchanged":
			return "Native source snapshot is unchanged; inspect analyzer and configuration caveats for measurement changes.";
		default:
			return "Native source fingerprint unavailable; target-content change cannot be verified from these artifacts.";
	}
}

function unchangedHeadline(comparison: ReportComparison): string[] {
	if (comparison.score?.delta !== 0 || comparison.metrics === undefined) return [];
	const changed = comparison.metrics.filter(
		(metric) => metric.delta !== undefined && metric.delta !== 0,
	);
	const severity = comparison.explanation?.persistentSeverityChanges.length ?? 0;
	return changed.length === 0 && severity === 0
		? []
		: [
				`Index unchanged while ${changed.length} raw metric values and ${severity} numeric persistent-finding facts changed; integer rounding or saturated terms can hide movement.`,
			];
}

export function comparisonReviewTerminal(comparison: ReportComparison): string[] {
	const explanation = comparison.explanation;
	if (explanation === undefined) return ["", "source input", `  ${sourceLine(comparison)}`];
	return [
		"",
		"change explanation",
		`  ${sourceLine(comparison)}`,
		...unchangedHeadline(comparison).map((line) => `  ${line}`),
		...(explanation.dimensionChanges.length === 0
			? []
			: [
					"  exact dimension points (before → after; exact delta; apportioned integer points)",
					...explanation.dimensionChanges.map(
						(row) =>
							`    ${row.dimension}: ${exact(row.baselineExactPoints)} → ${exact(row.currentExactPoints)} (${signed(row.deltaExactPoints)}); ${row.baselineRoundedPoints} → ${row.currentRoundedPoints} rounded`,
					),
				]),
		...(explanation.denominatorChanges.length === 0
			? []
			: [
					`  changed density denominators (${explanation.denominatorChanges.length})`,
					...explanation.denominatorChanges
						.slice(0, 5)
						.map(
							(row) =>
								`    ${row.metricId}: ${formatNumber(row.baselineNumerator)}/${formatNumber(row.baselineDenominator)} → ${formatNumber(row.currentNumerator)}/${formatNumber(row.currentDenominator)}`,
						),
				]),
		...(explanation.persistentSeverityChanges.length === 0
			? []
			: [
					`  numeric persistent-finding changes (${explanation.persistentSeverityChanges.length})`,
					...explanation.persistentSeverityChanges
						.slice(0, 5)
						.map(
							(row) => `    ${row.kind} ${row.path} ${row.field}: ${row.baseline} → ${row.current}`,
						),
				]),
		`  saturated density terms: ${explanation.baselineSaturatedDensityTerms.join(", ") || "none"} → ${explanation.currentSaturatedDensityTerms.join(", ") || "none"}`,
		"  Review located findings and set explicit metric budgets; there is no default quality cutoff.",
	];
}

export function comparisonReviewMarkdown(comparison: ReportComparison): string[] {
	const explanation = comparison.explanation;
	if (explanation === undefined) return ["", "## Source input", "", sourceLine(comparison)];
	return [
		"",
		"## Change explanation",
		"",
		sourceLine(comparison),
		...unchangedHeadline(comparison),
		...(explanation.dimensionChanges.length === 0
			? []
			: [
					"",
					"| dimension | exact points before | exact points after | exact delta | integer points before → after |",
					"| --- | ---: | ---: | ---: | ---: |",
					...explanation.dimensionChanges.map(
						(row) =>
							`| ${row.dimension} | ${exact(row.baselineExactPoints)} | ${exact(row.currentExactPoints)} | ${signed(row.deltaExactPoints)} | ${row.baselineRoundedPoints} → ${row.currentRoundedPoints} |`,
					),
				]),
		...(explanation.denominatorChanges.length === 0
			? []
			: [
					"",
					`Changed density denominators (${explanation.denominatorChanges.length}):`,
					...explanation.denominatorChanges
						.slice(0, 5)
						.map(
							(row) =>
								`- ${row.metricId}: ${row.baselineNumerator}/${row.baselineDenominator} → ${row.currentNumerator}/${row.currentDenominator}`,
						),
				]),
		...(explanation.persistentSeverityChanges.length === 0
			? []
			: [
					"",
					`Numeric persistent-finding changes (${explanation.persistentSeverityChanges.length}):`,
					...explanation.persistentSeverityChanges
						.slice(0, 5)
						.map(
							(row) => `- ${row.kind} ${row.path} ${row.field}: ${row.baseline} → ${row.current}`,
						),
				]),
		"",
		`Saturated density terms: ${explanation.baselineSaturatedDensityTerms.join(", ") || "none"} → ${explanation.currentSaturatedDensityTerms.join(", ") || "none"}.`,
		"Review located findings and set explicit metric budgets; there is no default quality cutoff.",
	];
}
