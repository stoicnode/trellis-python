/** Review context derived only from versioned report facts. */
import type { AuditReport, Finding, MetricValue } from "../contract/index.ts";
import { SCORING_FORMULA } from "../scoring/formula.ts";

export interface BurdenRow {
	label: string;
	count: MetricValue | undefined;
	density: MetricValue | undefined;
}

const BURDEN_PAIRS = [
	[
		"eroded functions / mass share",
		"erosion.eroded-count.production",
		"erosion.eroded-share.production",
	],
	[
		"clone groups / line density",
		"duplication.groups.production",
		"duplication.density.production",
	],
	[
		"cyclic groups / module density",
		"import-cycle.groups.production",
		"import-cycle.density.production",
	],
	[
		"candidate copies / eligible-line density",
		"duplication.candidate.independent-copies.production",
		"duplication.candidate.density.production",
	],
] as const;

export function burdenRows(report: AuditReport): BurdenRow[] {
	return BURDEN_PAIRS.map(([label, count, density]) => ({
		label,
		count: report.metrics[count],
		density: report.metrics[density],
	})).filter((row) => row.count !== undefined || row.density !== undefined);
}

export interface SaturatedTerm {
	metricId: string;
	value: number;
	threshold: number;
}

/** Saturation is a property of the current formula's linear density terms only. */
export function saturatedTerms(report: AuditReport): SaturatedTerm[] {
	if (report.scoringVersion !== SCORING_FORMULA.version) return [];
	return SCORING_FORMULA.dimensions.flatMap((dimension) =>
		dimension.terms.flatMap((term) => {
			if (!("saturatesAt" in term)) return [];
			const metric = report.metrics[term.metricId];
			return metric?.state === "complete" &&
				metric.value !== undefined &&
				metric.value >= term.saturatesAt
				? [{ metricId: term.metricId, value: metric.value, threshold: term.saturatesAt }]
				: [];
		}),
	);
}

/** One top located contributor per scored structural finding kind. */
export function topContributors(report: AuditReport): Finding[] {
	const kinds = ["complexity.hotspot", "duplication.clone-group", "import-cycle"];
	return kinds.flatMap((kind) => {
		const first = report.findings.find(
			(finding) =>
				finding.kind === kind &&
				(kind === "import-cycle"
					? finding.facts?.scored === true
					: finding.facts?.sourceSet === "production"),
		);
		return first === undefined ? [] : [first];
	});
}

export function documentationFindings(report: AuditReport): Finding[] {
	return report.findings.filter((finding) => finding.kind === "documentation.excessive");
}

export function documentationThresholds(
	report: AuditReport,
): { lines: number; words: number } | null {
	const detail = report.metrics["documentation.excessive.production"]?.detail;
	const lines = detail?.maxContentLines;
	const words = detail?.maxWords;
	return typeof lines === "number" && typeof words === "number" ? { lines, words } : null;
}

/** Graph counts are workspace-wide; the scored cycle view is production-induced. */
export interface GraphContext {
	productionFiles: number;
	productionCycleState: string;
	workspaceGraphState: string;
	workspaceLocalEdges: number | null;
	workspaceTypeOnlyEdges: number | null;
	workspaceDeferredEdges: number | null;
	workspaceConditionalEdges: number | null;
	workspaceUnresolvedEdges: number | null;
	productionCycleGroups: number | null;
	productionTypeOnlyCycleGroups: number | null;
	unsupportedFiles: number;
}

function metricNumber(metric: MetricValue | undefined): number | null {
	return metric?.value ?? null;
}

function detailNumber(metric: MetricValue | undefined, key: string): number | null {
	const value = metric?.detail?.[key];
	return typeof value === "number" ? value : null;
}

export function graphContext(report: AuditReport): GraphContext {
	const local = report.metrics["graph.edges.local"];
	const groups = report.metrics["import-cycle.groups.production"];
	return {
		productionFiles: report.sourceCoverage.production?.files ?? 0,
		productionCycleState: groups?.state ?? "unknown",
		workspaceGraphState: local?.state ?? "unknown",
		workspaceLocalEdges: metricNumber(local),
		workspaceTypeOnlyEdges: detailNumber(local, "typeOnly"),
		workspaceDeferredEdges: detailNumber(local, "deferred"),
		workspaceConditionalEdges: detailNumber(local, "conditional"),
		workspaceUnresolvedEdges: metricNumber(report.metrics["graph.edges.unresolved"]),
		productionCycleGroups: metricNumber(groups),
		productionTypeOnlyCycleGroups: detailNumber(groups, "typeOnly"),
		unsupportedFiles: report.sourceCoverage.unsupported?.files ?? 0,
	};
}
