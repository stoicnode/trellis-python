#!/usr/bin/env bun
/** Formula-only research scenarios over pinned Python calibration measurements. */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import type { MetricValue } from "../src/contract/index.ts";
import {
	normalizeCount,
	normalizeTerm,
	roundHalfUp,
	SCORING_FORMULA,
} from "../src/scoring/formula.ts";
import { scoreSloppiness } from "../src/scoring/sloppiness.ts";

const metricSchema = z
	.object({
		id: z.string(),
		state: z.string(),
		value: z.number().optional(),
	})
	.passthrough();
const artifactSchema = z.object({
	scopes: z.array(
		z.object({
			repository: z.string(),
			scope: z.string(),
			runs: z
				.array(
					z.object({
						metrics: z.record(z.string(), metricSchema),
						score: z.object({ index: z.number().nullable() }),
					}),
				)
				.min(1),
		}),
	),
});

interface Scenario {
	id: string;
	scale?: { metricId: string; factor: number };
	countShare?: number;
	weight?: { dimension: string; delta: number };
}

const scenarios: Scenario[] = [{ id: "baseline" }];
for (const dimension of SCORING_FORMULA.dimensions) {
	for (const term of dimension.terms) {
		for (const factor of [0.75, 1.25]) {
			scenarios.push({
				id: `${term.metricId}:scale:${factor}`,
				scale: { metricId: term.metricId, factor },
			});
		}
	}
}
for (const countShare of [0.25, 0.75])
	scenarios.push({ id: `count-share:${countShare}`, countShare });
for (const dimension of SCORING_FORMULA.dimensions) {
	for (const delta of [-0.1, 0.1]) {
		scenarios.push({
			id: `${dimension.dimension}:weight:${delta}`,
			weight: { dimension: dimension.dimension, delta },
		});
	}
}

function weightFor(dimension: string, scenario: Scenario): number {
	const current = SCORING_FORMULA.dimensions.find((entry) => entry.dimension === dimension);
	if (current === undefined) throw new Error(`unknown dimension ${dimension}`);
	if (scenario.weight === undefined) return current.weight;
	const target = SCORING_FORMULA.dimensions.find(
		(entry) => entry.dimension === scenario.weight?.dimension,
	);
	if (target === undefined) throw new Error("unknown weight target");
	if (dimension === target.dimension) return current.weight + scenario.weight.delta;
	return current.weight * (1 - scenario.weight.delta / (1 - target.weight));
}

function termPoints(
	term: (typeof SCORING_FORMULA.dimensions)[number]["terms"][number],
	metric: MetricValue | undefined,
	scenario: Scenario,
): number | null {
	if (metric?.state === "not-applicable") return 0;
	if (metric?.state !== "complete" || metric.value === undefined) return null;
	const factor = scenario.scale?.metricId === term.metricId ? scenario.scale.factor : 1;
	const share =
		scenario.countShare === undefined
			? term.share
			: "countScale" in term
				? scenario.countShare
				: 1 - scenario.countShare;
	const normalized =
		"countScale" in term
			? normalizeCount(metric.value, term.countScale * factor)
			: normalizeTerm(metric.value, term.saturatesAt * factor);
	return share * normalized;
}

function dimensionPoints(
	dimension: (typeof SCORING_FORMULA.dimensions)[number],
	byId: ReadonlyMap<string, MetricValue>,
	scenario: Scenario,
): number | null {
	const terms = dimension.terms.map((term) => termPoints(term, byId.get(term.metricId), scenario));
	if (terms.some((points) => points === null)) return null;
	return (
		weightFor(dimension.dimension, scenario) *
		terms.reduce<number>((sum, points) => sum + (points ?? 0), 0)
	);
}

function evaluate(
	metrics: readonly MetricValue[],
	scenario: Scenario,
): {
	index: number | null;
	exact: number | null;
	dimensions: Record<string, number | null>;
} {
	const baseline = scoreSloppiness(metrics);
	const byId = new Map(metrics.map((metric) => [metric.id, metric]));
	const dimensions: Record<string, number | null> = {};
	for (const dimension of SCORING_FORMULA.dimensions) {
		dimensions[dimension.dimension] = dimensionPoints(dimension, byId, scenario);
	}
	if (baseline.partial) return { index: null, exact: null, dimensions };
	const exact = Object.values(dimensions).reduce<number>((sum, points) => sum + (points ?? 0), 0);
	return { index: Math.min(100, Math.max(0, roundHalfUp(exact))), exact, dimensions };
}

interface RankedScope {
	baselineIndex: number | null;
	results: Array<{ scenario: string; index: number | null }>;
}

function scenarioIndex(scope: RankedScope, id: string): number {
	const index = scope.results.find((entry) => entry.scenario === id)?.index;
	if (index === null || index === undefined) throw new Error(`missing scenario index for ${id}`);
	return index;
}

function comparePair(
	left: RankedScope,
	right: RankedScope,
	id: string,
): "reverse" | "tie" | "same" | "skip" {
	if (left.baselineIndex === null || right.baselineIndex === null) return "skip";
	const initial = Math.sign(left.baselineIndex - right.baselineIndex);
	if (initial === 0) return "skip";
	const later = Math.sign(scenarioIndex(left, id) - scenarioIndex(right, id));
	if (later === -initial) return "reverse";
	return later === 0 ? "tie" : "same";
}

function compareScenario(
	scopes: readonly RankedScope[],
	scenario: Scenario,
): {
	scenario: string;
	eligiblePairs: number;
	reversals: number;
	tiesCreated: number;
} {
	const outcomes: Array<ReturnType<typeof comparePair>> = [];
	for (let i = 0; i < scopes.length; i += 1) {
		for (let j = i + 1; j < scopes.length; j += 1) {
			const left = scopes[i];
			const right = scopes[j];
			if (left !== undefined && right !== undefined)
				outcomes.push(comparePair(left, right, scenario.id));
		}
	}
	return {
		scenario: scenario.id,
		eligiblePairs: outcomes.filter((outcome) => outcome !== "skip").length,
		reversals: outcomes.filter((outcome) => outcome === "reverse").length,
		tiesCreated: outcomes.filter((outcome) => outcome === "tie").length,
	};
}

export function analyze(path: string): unknown {
	const artifact = artifactSchema.parse(JSON.parse(readFileSync(path, "utf8")));
	const scopes = artifact.scopes.map((scope) => {
		const first = scope.runs[0];
		if (first === undefined) throw new Error(`missing run for ${scope.scope}`);
		const metrics = Object.values(first.metrics) as MetricValue[];
		const baseline = scoreSloppiness(metrics);
		if (baseline.index !== first.score.index)
			throw new Error(`baseline mismatch for ${scope.scope}`);
		const results = scenarios.map((scenario) => ({
			scenario: scenario.id,
			...evaluate(metrics, scenario),
		}));
		const published = results.flatMap((result) => (result.index === null ? [] : [result.index]));
		const saturation = SCORING_FORMULA.dimensions.flatMap((dimension) =>
			dimension.terms.flatMap((term) => {
				if (!("saturatesAt" in term)) return [];
				const value = first.metrics[term.metricId]?.value;
				return [
					{
						metricId: term.metricId,
						saturated: value === undefined ? null : value >= term.saturatesAt,
					},
				];
			}),
		);
		return {
			id: scope.scope,
			repository: scope.repository,
			partial: baseline.partial,
			unknownDimensions: baseline.unknownDimensions,
			baselineIndex: baseline.index,
			range: published.length === 0 ? null : [Math.min(...published), Math.max(...published)],
			saturation,
			results,
		};
	});
	const comparisons = scenarios.map((scenario) => compareScenario(scopes, scenario));
	return { scenarios, scopes, comparisons };
}

if (import.meta.main) {
	const [input, output] = process.argv.slice(2);
	if (input === undefined || output === undefined)
		throw new Error("usage: python-calibration-sensitivity.ts <measurement.json> <output.json>");
	writeFileSync(output, `${JSON.stringify(analyze(input), null, 2)}\n`);
}
