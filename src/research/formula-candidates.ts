/** Isolated research formulas. None of these enter an audit or score version. */
import type { MetricValue } from "../contract/index.ts";
import { buildAdjacency, stronglyConnectedComponents } from "../metrics/cycles.ts";
import { normalizeCount } from "../scoring/formula.ts";
import { apportionPoints, normalizeTerm, roundHalfUp } from "../scoring/index.ts";

export interface CandidateEdge {
	from: string;
	to: string;
	edgeClass: "runtime" | "type-only";
}

export interface CycleClassSignals {
	groups: number;
	sccBurden: number;
	distinctCyclicEdges: number;
	selfLoops: number;
}

export interface CycleSignals {
	all: CycleClassSignals;
	runtime: CycleClassSignals;
	typeOnly: CycleClassSignals;
}

export interface FunctionSignal {
	cc: number;
	executableSloc: number;
}

export interface CandidateSignals {
	cycle: CycleSignals;
	complexitySeverity: number;
	complexitySeveritySmooth: number;
}

export type ExperimentId =
	| "authoritative"
	| "cycle-scc-burden"
	| "cycle-distinct-edges"
	| "complexity-severity"
	| "complexity-severity-smooth"
	| "smooth-density"
	| "clone-candidates"
	| "edge-class"
	| "combined-v1";

export const EXPERIMENT_IDS: readonly ExperimentId[] = [
	"authoritative",
	"cycle-scc-burden",
	"cycle-distinct-edges",
	"complexity-severity",
	"complexity-severity-smooth",
	"smooth-density",
	"clone-candidates",
	"edge-class",
	"combined-v1",
];

function classSignals(
	nodes: readonly string[],
	edges: readonly CandidateEdge[],
	edgeClass: CandidateEdge["edgeClass"] | undefined,
): CycleClassSignals {
	const selected = edges.filter((edge) => edgeClass === undefined || edge.edgeClass === edgeClass);
	const unique = new Set(selected.map((edge) => `${edge.from}\0${edge.to}`));
	const adjacency = buildAdjacency(nodes, selected);
	const cyclic = stronglyConnectedComponents(nodes, adjacency).filter(
		(component) => component.length > 1 || unique.has(`${component[0]}\0${component[0]}`),
	);
	const owner = new Map(
		cyclic.flatMap((component, index) => component.map((node) => [node, index] as const)),
	);
	const selfLoops = [...unique].filter((key) => {
		const [from, to] = key.split("\0");
		return from === to && from !== undefined && owner.has(from);
	}).length;
	const distinctCyclicEdges = [...unique].filter((key) => {
		const [from, to] = key.split("\0");
		return (
			from !== undefined && to !== undefined && owner.has(from) && owner.get(from) === owner.get(to)
		);
	}).length;
	return {
		groups: cyclic.length,
		sccBurden: cyclic.reduce((sum, component) => sum + component.length - 1, 0) + selfLoops,
		distinctCyclicEdges,
		selfLoops,
	};
}

/** SCC burden is monotone under edge addition on a fixed node set. */
export function cycleSignals(
	nodes: readonly string[],
	edges: readonly CandidateEdge[],
): CycleSignals {
	return {
		all: classSignals(nodes, edges, undefined),
		runtime: classSignals(nodes, edges, "runtime"),
		typeOnly: classSignals(nodes, edges, "type-only"),
	};
}

export function complexitySeverity(functions: readonly FunctionSignal[]): number {
	return functions.reduce(
		(sum, fn) => sum + Math.max(0, fn.cc - 10) * Math.sqrt(fn.executableSloc),
		0,
	);
}

export function smoothComplexitySeverity(functions: readonly FunctionSignal[]): number {
	return functions.reduce(
		(sum, fn) => sum + Math.log1p(Math.max(0, fn.cc - 10)) * Math.sqrt(fn.executableSloc),
		0,
	);
}

export function measureCandidateSignals(
	nodes: readonly string[],
	edges: readonly CandidateEdge[],
	functions: readonly FunctionSignal[],
): CandidateSignals {
	return {
		cycle: cycleSignals(nodes, edges),
		complexitySeverity: complexitySeverity(functions),
		complexitySeveritySmooth: smoothComplexitySeverity(functions),
	};
}

/** At the old linear cap this curve reaches 90%, with no finite saturation. */
export function smoothDensity(value: number, oldCap: number): number {
	return 100 * (1 - Math.exp((-Math.log(10) * value) / oldCap));
}

function metricNumber(metrics: Readonly<Record<string, MetricValue>>, id: string): number | null {
	const metric = metrics[id];
	if (metric?.state === "not-applicable") return 0;
	return metric?.state === "complete" ? (metric.value ?? null) : null;
}

function complexityInput(signals: CandidateSignals, experiment: ExperimentId): number | undefined {
	if (experiment === "complexity-severity" || experiment === "combined-v1")
		return signals.complexitySeverity;
	if (experiment === "complexity-severity-smooth") return signals.complexitySeveritySmooth;
	return undefined;
}

function cloneMetric(experiment: ExperimentId, suffix: "independent-copies" | "density"): string {
	const candidate = experiment === "clone-candidates" || experiment === "combined-v1";
	if (suffix === "density")
		return candidate
			? "duplication.candidate.density.production"
			: "duplication.density.production";
	return candidate
		? "duplication.candidate.independent-copies.production"
		: "duplication.groups.production";
}

function cycleInput(signals: CandidateSignals, experiment: ExperimentId): number | undefined {
	if (experiment === "cycle-scc-burden" || experiment === "combined-v1")
		return signals.cycle.all.sccBurden;
	if (experiment === "cycle-distinct-edges") return signals.cycle.all.distinctCyclicEdges;
	if (experiment === "edge-class")
		return signals.cycle.all.sccBurden - 0.5 * signals.cycle.typeOnly.sccBurden;
	return undefined;
}

export interface CandidateDimension {
	dimension: "complexity-erosion" | "duplication" | "import-cycle";
	exactPoints: number;
	roundedPoints: number;
	count: number;
	density: number;
}

export interface CandidateScore {
	experiment: ExperimentId;
	index: number | null;
	exactIndex: number | null;
	dimensions: CandidateDimension[];
	reason?: string;
}

function experimentInputs(
	metrics: Readonly<Record<string, MetricValue>>,
	signals: CandidateSignals,
	experiment: ExperimentId,
): [number | null, number | null, number | null, number | null, number | null, number | null] {
	const complexityCount =
		complexityInput(signals, experiment) ??
		metricNumber(metrics, "erosion.eroded-count.production");
	const cloneCount = metricNumber(metrics, cloneMetric(experiment, "independent-copies"));
	const cloneDensity = metricNumber(metrics, cloneMetric(experiment, "density"));
	const cycleCount =
		cycleInput(signals, experiment) ?? metricNumber(metrics, "import-cycle.groups.production");
	return [
		complexityCount,
		metricNumber(metrics, "erosion.eroded-share.production"),
		cloneCount,
		cloneDensity,
		cycleCount,
		metricNumber(metrics, "import-cycle.density.production"),
	];
}

/** Fixed 50/30/20 weights and 50/50 count/density shares in every ablation. */
export function scoreExperiment(
	metrics: Readonly<Record<string, MetricValue>>,
	signals: CandidateSignals,
	experiment: ExperimentId,
): CandidateScore {
	const inputs = experimentInputs(metrics, signals, experiment);
	const baselineInputs = ["erosion.eroded-count.production", "import-cycle.groups.production"];
	if (
		inputs.some((value) => value === null) ||
		baselineInputs.some((id) => metricNumber(metrics, id) === null)
	)
		return {
			experiment,
			index: null,
			exactIndex: null,
			dimensions: [],
			reason: "required measurement incomplete",
		};
	const [complexityCount, complexityDensity, cloneCount, cloneDensity, cycleCount, cycleDensity] =
		inputs as [number, number, number, number, number, number];
	const smooth = experiment === "smooth-density" || experiment === "combined-v1";
	const density = (raw: number, cap: number) =>
		smooth ? smoothDensity(raw, cap) : normalizeTerm(raw, cap);
	const specifications = [
		[
			"complexity-erosion",
			0.5,
			complexityCount,
			complexityDensity,
			experiment === "complexity-severity" ||
			experiment === "complexity-severity-smooth" ||
			experiment === "combined-v1"
				? 100
				: 20,
			0.25,
		],
		["duplication", 0.3, cloneCount, cloneDensity, 15, 0.15],
		["import-cycle", 0.2, cycleCount, cycleDensity, 5, 0.1],
	] as const;
	const exact = specifications.map(([dimension, weight, count, ratio, scale, cap]) => ({
		dimension,
		count,
		density: ratio,
		exactPoints: weight * (0.5 * normalizeCount(count, scale) + 0.5 * density(ratio, cap)),
	}));
	const exactIndex = exact.reduce((sum, row) => sum + row.exactPoints, 0);
	const points = apportionPoints(
		exactIndex,
		exact.map((row) => ({ key: row.dimension, exact: row.exactPoints })),
	);
	return {
		experiment,
		index: roundHalfUp(exactIndex),
		exactIndex,
		dimensions: exact.map((row) => ({ ...row, roundedPoints: points.get(row.dimension) ?? 0 })),
	};
}
