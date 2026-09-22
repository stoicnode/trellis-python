import { describe, expect, test } from "bun:test";
import type { MetricValue } from "../contract/index.ts";
import { scoreSloppiness } from "../scoring/index.ts";
import {
	type CandidateEdge,
	complexitySeverity,
	cycleSignals,
	measureCandidateSignals,
	scoreExperiment,
	smoothDensity,
} from "./formula-candidates.ts";

const VALUES: Record<string, number> = {
	"erosion.eroded-count.production": 4,
	"erosion.eroded-share.production": 0.35,
	"duplication.groups.production": 3,
	"duplication.density.production": 0.04,
	"duplication.candidate.independent-copies.production": 2,
	"duplication.candidate.density.production": 0.025,
	"import-cycle.groups.production": 2,
	"import-cycle.density.production": 0.02,
};
const METRICS = Object.fromEntries(
	Object.entries(VALUES).map(([id, value]) => [
		id,
		{ id, value, unit: "count", state: "complete" },
	]),
) as Record<string, MetricValue>;
const SIGNALS = measureCandidateSignals(
	["a", "b", "c"],
	[
		{ from: "a", to: "b", edgeClass: "runtime" },
		{ from: "b", to: "a", edgeClass: "runtime" },
		{ from: "c", to: "c", edgeClass: "type-only" },
	],
	[{ cc: 31, executableSloc: 100 }],
);

describe("isolated formula candidates", () => {
	test("matches the authoritative score exactly at baseline", () => {
		const current = scoreSloppiness(Object.values(METRICS));
		const candidate = scoreExperiment(METRICS, SIGNALS, "authoritative");
		expect(candidate.index).toBe(current.index);
		expect(candidate.exactIndex).toBe(
			current.dimensions.reduce((sum, dimension) => sum + (dimension.exactPoints ?? 0), 0),
		);
		for (const dimension of candidate.dimensions) {
			expect(dimension.roundedPoints).toBe(
				current.dimensions.find((row) => row.dimension === dimension.dimension)?.points ?? -1,
			);
		}
	});

	test("never lowers SCC burden when an edge is added on a fixed node set", () => {
		const nodes = ["a", "b", "c", "d"];
		const possibilities: CandidateEdge[] = nodes.flatMap((from) =>
			nodes.map((to) => ({ from, to, edgeClass: "runtime" })),
		);
		for (let mask = 0; mask < 1 << possibilities.length; mask += 1) {
			const edges = possibilities.filter((_, index) => (mask & (1 << index)) !== 0);
			const before = cycleSignals(nodes, edges).runtime.sccBurden;
			for (let index = 0; index < possibilities.length; index += 1) {
				if ((mask & (1 << index)) !== 0) continue;
				const edge = possibilities[index];
				if (edge === undefined) continue;
				const after = cycleSignals(nodes, [...edges, edge]).runtime.sccBurden;
				expect(after).toBeGreaterThanOrEqual(before);
			}
		}
	});

	test("does not reward joining cyclic components", () => {
		const nodes = ["a", "b", "c", "d"];
		const edges: CandidateEdge[] = [
			{ from: "a", to: "b", edgeClass: "runtime" },
			{ from: "b", to: "a", edgeClass: "runtime" },
			{ from: "c", to: "d", edgeClass: "runtime" },
			{ from: "d", to: "c", edgeClass: "runtime" },
		];
		const before = cycleSignals(nodes, edges).runtime.sccBurden;
		const joined = cycleSignals(nodes, [
			...edges,
			{ from: "b", to: "c", edgeClass: "runtime" },
			{ from: "d", to: "a", edgeClass: "runtime" },
		]).runtime.sccBurden;
		expect(before).toBe(2);
		expect(joined).toBe(3);
	});

	test("retains cycles formed jointly by runtime and type-only edges", () => {
		const mixed = cycleSignals(
			["a", "b"],
			[
				{ from: "a", to: "b", edgeClass: "runtime" },
				{ from: "b", to: "a", edgeClass: "type-only" },
			],
		);
		expect(mixed.all.sccBurden).toBe(1);
		expect(mixed.runtime.sccBurden).toBe(0);
		expect(mixed.typeOnly.sccBurden).toBe(0);
	});

	test("tracks severity above the CC threshold", () => {
		expect(complexitySeverity([{ cc: 31, executableSloc: 100 }])).toBe(210);
		expect(complexitySeverity([{ cc: 11, executableSloc: 100 }])).toBe(10);
		expect(complexitySeverity([{ cc: 10, executableSloc: 100 }])).toBe(0);
	});

	test("keeps the smooth density responsive beyond the old cap", () => {
		expect(smoothDensity(0, 0.25)).toBe(0);
		expect(smoothDensity(0.25, 0.25)).toBeCloseTo(90);
		expect(smoothDensity(0.5, 0.25)).toBeGreaterThan(smoothDensity(0.25, 0.25));
		expect(smoothDensity(0.5, 0.25)).toBeLessThan(100);
	});

	test("withholds a candidate when its source metric is incomplete", () => {
		const missing = { ...METRICS };
		delete missing["duplication.candidate.density.production"];
		expect(scoreExperiment(missing, SIGNALS, "clone-candidates").index).toBeNull();
	});
});
