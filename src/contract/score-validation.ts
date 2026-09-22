/** Cross-field validation for versioned score shapes. */
import type { z } from "zod";
import type { MetricValue } from "./metric.ts";
import type { Score } from "./report.ts";
import { rollUpCompleteness } from "./states.ts";

export interface HonestScoreReport {
	metrics: Record<string, MetricValue>;
	completeness: "complete" | "incomplete";
	score: Score;
}

export function validateMeasurementHonesty(report: HonestScoreReport, ctx: z.RefinementCtx): void {
	for (const [key, metric] of Object.entries(report.metrics)) {
		if (key !== metric.id) {
			ctx.addIssue({
				code: "custom",
				message: `metrics key "${key}" must equal the metric id "${metric.id}"`,
				path: ["metrics", key, "id"],
			});
		}
	}
	const rolledUp = rollUpCompleteness(Object.values(report.metrics).map((metric) => metric.state));
	if (report.completeness !== rolledUp) {
		ctx.addIssue({
			code: "custom",
			message: `completeness "${report.completeness}" does not match the metric-state rollup "${rolledUp}"`,
			path: ["completeness"],
		});
	}
	for (const [i, contribution] of report.score.contributions.entries()) {
		for (const metricId of contribution.metricIds) {
			if (!(metricId in report.metrics)) {
				ctx.addIssue({
					code: "custom",
					message: `contribution "${contribution.dimension}" references unknown metric "${metricId}"`,
					path: ["score", "contributions", i, "metricIds"],
				});
			}
		}
	}
}

export function validateCurrentScore(report: HonestScoreReport, ctx: z.RefinementCtx): void {
	const unknown = report.score.unknownDimensions;
	if (unknown === undefined) {
		ctx.addIssue({
			code: "custom",
			message: "current reports must declare score.unknownDimensions",
			path: ["score", "unknownDimensions"],
		});
		return;
	}
	const unique = new Set(unknown);
	if (unique.size !== unknown.length) {
		ctx.addIssue({
			code: "custom",
			message: "score.unknownDimensions must be unique",
			path: ["score", "unknownDimensions"],
		});
	}
	if (
		report.score.partial !== unknown.length > 0 ||
		(report.score.index === null) !== report.score.partial
	) {
		ctx.addIssue({
			code: "custom",
			message: "withheld scores require unknown dimensions and a null index",
			path: ["score"],
		});
	}
	for (const [i, contribution] of report.score.contributions.entries()) {
		if ((contribution.points === null) !== unique.has(contribution.dimension)) {
			ctx.addIssue({
				code: "custom",
				message: "only unknown dimensions may withhold contribution points",
				path: ["score", "contributions", i, "points"],
			});
		}
	}
	for (const dimension of unknown) {
		if (report.score.contributions.filter((entry) => entry.dimension === dimension).length !== 1) {
			ctx.addIssue({
				code: "custom",
				message: `unknown dimension "${dimension}" must have one contribution`,
				path: ["score", "contributions"],
			});
		}
	}
}
