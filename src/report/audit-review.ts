/** Focused human review panels, shared by terminal and Markdown surfaces. */
import type { AuditReport } from "../contract/index.ts";
import {
	burdenRows,
	documentationFindings,
	documentationThresholds,
	graphContext,
	saturatedTerms,
	topContributors,
} from "./audit-context.ts";
import { findingLocation, formatMetric, formatNumber } from "./audit-format.ts";

function value(metric: AuditReport["metrics"][string] | undefined): string {
	return metric === undefined ? "unknown" : formatMetric(metric);
}

function count(value: number | null): string {
	return value === null ? "unknown" : formatNumber(value);
}

/** The production graph and denominator are explicit; workspace edge evidence is labeled. */
export function auditReviewTerminal(report: AuditReport, documentationLimit: number): string[] {
	const graph = graphContext(report);
	const docs = documentationFindings(report);
	const thresholds = documentationThresholds(report);
	const saturated = saturatedTerms(report);
	const leaders = topContributors(report);
	return [
		"production burden (absolute count · density with numerator/denominator)",
		...burdenRows(report).map(
			(row) => `  ${row.label}: ${value(row.count)} · ${value(row.density)}`,
		),
		`  score state: ${report.score.partial ? `unknown dimensions: ${report.score.unknownDimensions?.join(", ") ?? "unspecified"}` : "complete"}`,
		...(saturated.length === 0
			? []
			: [
					`  saturated density terms: ${saturated.map((term) => `${term.metricId} ${formatNumber(term.value)} ≥ ${formatNumber(term.threshold)}`).join(", ")}`,
				]),
		"",
		"graph scope and observation limits",
		`  scored production graph (${graph.productionCycleState}): ${graph.productionFiles} files · ${count(graph.productionCycleGroups)} cyclic groups (${count(graph.productionTypeOnlyCycleGroups)} type-only)`,
		`  workspace relationships (${graph.workspaceGraphState}): ${count(graph.workspaceLocalEdges)} local · ${count(graph.workspaceTypeOnlyEdges)} type-only · ${count(graph.workspaceDeferredEdges)} deferred · ${count(graph.workspaceConditionalEdges)} conditional`,
		`  unresolved workspace edges: ${count(graph.workspaceUnresolvedEdges)} · unsupported files: ${graph.unsupportedFiles}`,
		...(leaders.length === 0
			? []
			: [
					"",
					"top located contributors (one per structural kind)",
					...leaders.map(
						(finding) => `  ${finding.kind} ${findingLocation(finding)} · ${finding.summary}`,
					),
				]),
		"",
		"documentation review (advisory; outside the structural score)",
		`  production: ${value(report.metrics["documentation.excessive.production"])} · test: ${value(report.metrics["documentation.excessive.test"])}${thresholds === null ? "" : ` · thresholds: >${thresholds.lines} content lines or >${thresholds.words} words`}`,
		...docs
			.slice(0, documentationLimit)
			.map((finding) => `  ${findingLocation(finding)} · ${finding.summary}`),
		...(docs.length > documentationLimit
			? [`  … (+${docs.length - documentationLimit} more)`]
			: []),
		"  Review findings and set explicit metric budgets for your workspace; the index has no default quality cutoff.",
	];
}

function cell(text: string): string {
	return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

/** The same review facts in an exportable Markdown section. */
export function auditReviewMarkdown(report: AuditReport, documentationLimit: number): string[] {
	const graph = graphContext(report);
	const docs = documentationFindings(report);
	const thresholds = documentationThresholds(report);
	const saturated = saturatedTerms(report);
	const leaders = topContributors(report);
	return [
		"",
		"## Production burden",
		"",
		"Absolute counts and density are shown together. Density cells include their numerator and denominator when observed.",
		"",
		"| signal | absolute | density |",
		"| --- | ---: | ---: |",
		...burdenRows(report).map(
			(row) => `| ${cell(row.label)} | ${cell(value(row.count))} | ${cell(value(row.density))} |`,
		),
		"",
		`Score state: ${report.score.partial ? `unknown dimensions: ${report.score.unknownDimensions?.join(", ") ?? "unspecified"}` : "complete"}.`,
		...(saturated.length === 0
			? []
			: [
					`Saturated density terms: ${saturated.map((term) => `${term.metricId} ${formatNumber(term.value)} ≥ ${formatNumber(term.threshold)}`).join(", ")}.`,
				]),
		"",
		"## Graph scope and observation limits",
		"",
		`Scored production graph (${graph.productionCycleState}): ${graph.productionFiles} files; ${count(graph.productionCycleGroups)} cyclic groups, including ${count(graph.productionTypeOnlyCycleGroups)} type-only groups.`,
		`Workspace relationships (${graph.workspaceGraphState}): ${count(graph.workspaceLocalEdges)} local, ${count(graph.workspaceTypeOnlyEdges)} type-only, ${count(graph.workspaceDeferredEdges)} deferred, ${count(graph.workspaceConditionalEdges)} conditional.`,
		`Unresolved workspace edges: ${count(graph.workspaceUnresolvedEdges)}. Unsupported files: ${graph.unsupportedFiles}.`,
		...(leaders.length === 0
			? []
			: [
					"",
					"## Top located contributors",
					"",
					"| kind | location | summary |",
					"| --- | --- | --- |",
					...leaders.map(
						(finding) =>
							`| ${finding.kind} | ${cell(findingLocation(finding))} | ${cell(finding.summary)} |`,
					),
				]),
		"",
		"## Documentation review (advisory)",
		"",
		`Production: ${value(report.metrics["documentation.excessive.production"])}; test: ${value(report.metrics["documentation.excessive.test"])}.${thresholds === null ? "" : ` Thresholds: more than ${thresholds.lines} content lines or ${thresholds.words} words.`}`,
		...(docs.length === 0
			? []
			: [
					"",
					"| location | observed block |",
					"| --- | --- |",
					...docs
						.slice(0, documentationLimit)
						.map((finding) => `| ${cell(findingLocation(finding))} | ${cell(finding.summary)} |`),
					...(docs.length > documentationLimit
						? [`| … | +${docs.length - documentationLimit} more |`]
						: []),
				]),
		"",
		"Review findings and set explicit metric budgets for your workspace; the index has no default quality cutoff.",
	];
}
