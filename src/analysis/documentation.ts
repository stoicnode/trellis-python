/** Native advisory documentation wrapper and its recorded measurement identity. */
import type { EffectiveDocumentationConfig } from "../contract/index.ts";
import { analyzeDocumentation, type DocumentationAnalysis } from "../documentation/analyze.ts";
import type { SyntaxInventory } from "../syntax/index.ts";
import type { NativeAnalysisRun } from "./native.ts";
import {
	MEASURED_SOURCE_SETS,
	nativeAnalysisIdentity,
	nativeAnalyzerIdentity,
	nativeScope,
} from "./provenance.ts";

/** Advisory documentation review over actual Python docstrings and attached TS JSDoc. */
export function runDocumentationAnalysis(
	syntax: SyntaxInventory,
	config: EffectiveDocumentationConfig,
): NativeAnalysisRun<DocumentationAnalysis> {
	const product = analyzeDocumentation(syntax, config);
	const scope = nativeScope(syntax, MEASURED_SOURCE_SETS);
	const identityOptions = {
		enabled: config.enabled,
		"max-content-lines": config.maxContentLines,
		"max-words": config.maxWords,
	};
	return {
		product,
		result: {
			provider: nativeAnalyzerIdentity("trellis.documentation", "shared-parse", identityOptions),
			state: scope.outcome.state,
			observedCoverage: scope.outcome.observedCoverage,
			...(scope.outcome.reason === undefined ? {} : { reason: scope.outcome.reason }),
			analysis: nativeAnalysisIdentity(scope, syntax.compilerVersion, identityOptions),
			metrics: product.metrics,
			findings: product.findings,
		},
	};
}
