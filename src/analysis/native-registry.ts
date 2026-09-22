/** Declared native capabilities and metric ownership. */
import { GRAPH_POLICY_VERSION } from "../metrics/index.ts";
import { DUPLICATION_METRICS } from "./duplication-metrics.ts";
import { nativeAnalyzerIdentity } from "./provenance.ts";
import {
	buildNativeRegistry,
	type NativeAnalyzerRegistration,
	type NativeRegistry,
	requiredForScoring,
} from "./registry.ts";

export const DUPLICATION_NATIVE_OPTIONS = {
	engine: "suffix-array-lcp",
	"work-accounting": "v2",
} as const;

/** Supported native analyzer ids, sorted. */
export const NATIVE_ANALYZER_IDS = [
	"trellis.complexity",
	"trellis.dependency-graph",
	"trellis.documentation",
	"trellis.duplication",
	"trellis.executable-scopes",
	"trellis.import-cycles",
	"trellis.safeguards",
] as const;

export type NativeAnalyzerId = (typeof NATIVE_ANALYZER_IDS)[number];

/** The complexity analyzer's metric ids (mirrors `analyzeComplexity` output, sorted). */
const COMPLEXITY_METRICS = [
	"complexity.cc.max.production",
	"complexity.cc.max.test",
	"complexity.cc.p50.production",
	"complexity.cc.p50.test",
	"complexity.cc.p90.production",
	"complexity.cc.p90.test",
	"complexity.executable-sloc.production",
	"complexity.executable-sloc.test",
	"complexity.functions.production",
	"complexity.functions.test",
	"complexity.nesting.max.production",
	"complexity.nesting.max.test",
	"erosion.eroded-count.production",
	"erosion.eroded-count.test",
	"erosion.eroded-share.production",
	"erosion.eroded-share.test",
	"erosion.mass.production",
	"erosion.mass.test",
] as const;

const DOCUMENTATION_METRICS = [
	"documentation.blocks.production",
	"documentation.blocks.test",
	"documentation.excessive.production",
	"documentation.excessive.test",
] as const;

const EXECUTABLE_SCOPE_METRICS = [
	"executable.initialization.decisions.production",
	"executable.initialization.decisions.test",
	"executable.initialization.max-decisions.production",
	"executable.initialization.max-decisions.test",
	"executable.initialization.units.production",
	"executable.initialization.units.test",
	"executable.nesting.findings.production",
	"executable.nesting.findings.test",
	"executable.nesting.max.production",
	"executable.nesting.max.test",
] as const;

/** The dependency-graph analyzer's metric ids (mirrors its output, sorted). */
const GRAPH_METRICS = [
	"graph.edges.external",
	"graph.edges.local",
	"graph.edges.unresolved",
	"graph.files",
	"graph.observation.dynamic.resolved.production",
	"graph.observation.dynamic.resolved.test",
	"graph.observation.dynamic.unresolved.production",
	"graph.observation.dynamic.unresolved.test",
] as const;

/** The import-cycle analyzer's metric ids (mirrors its output, sorted). */
const CYCLE_METRICS = [
	"import-cycle.density",
	"import-cycle.density.production",
	"import-cycle.groups",
	"import-cycle.groups.production",
	"import-cycle.modules",
	"import-cycle.modules.production",
] as const;

const complexityAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity("trellis.complexity", "shared-parse"),
	capabilities: ["complexity"],
	metrics: COMPLEXITY_METRICS,
	requires: [],
};

const documentationAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity("trellis.documentation", "shared-parse"),
	capabilities: ["documentation"],
	metrics: DOCUMENTATION_METRICS,
	requires: [],
};

const executableScopesAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity("trellis.executable-scopes", "shared-parse"),
	capabilities: ["executable-scopes"],
	metrics: EXECUTABLE_SCOPE_METRICS,
	requires: [],
};

const duplicationAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity(
		"trellis.duplication",
		"shared-parse",
		DUPLICATION_NATIVE_OPTIONS,
	),
	capabilities: ["duplication"],
	metrics: DUPLICATION_METRICS,
	requires: [],
};

const dependencyGraphAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity("trellis.dependency-graph", "shared-parse", {
		"graph-policy": GRAPH_POLICY_VERSION,
	}),
	capabilities: ["dependency-graph"],
	metrics: GRAPH_METRICS,
	requires: [],
};

const importCyclesAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity("trellis.import-cycles", "graph", {
		"graph-policy": GRAPH_POLICY_VERSION,
	}),
	capabilities: ["import-cycles"],
	metrics: CYCLE_METRICS,
	requires: ["trellis.dependency-graph"],
};

const safeguardsAnalyzer: NativeAnalyzerRegistration = {
	identity: nativeAnalyzerIdentity("trellis.safeguards", "configuration-inspection"),
	capabilities: ["safeguards"],
	metrics: [],
	requires: [],
};

/** The audited native registry: every supported analyzer, validated at load. */
export const NATIVE_REGISTRY: NativeRegistry = buildNativeRegistry([
	complexityAnalyzer,
	documentationAnalyzer,
	duplicationAnalyzer,
	executableScopesAnalyzer,
	dependencyGraphAnalyzer,
	importCyclesAnalyzer,
	safeguardsAnalyzer,
]);

/**
 * The native analyses the current scoring catalog requires (AC3): owners of
 * catalog metric ids plus transitive prerequisites. The safeguard inspection
 * is never among them.
 */
export function nativeScoringRequiredIds(): string[] {
	return requiredForScoring(NATIVE_REGISTRY);
}
