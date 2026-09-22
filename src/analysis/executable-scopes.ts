/** Advisory executable ownership and nesting wrapper. */
import {
	analyzeExecutableScopes,
	type ExecutableScopeAnalysis,
} from "../metrics/executable-scopes.ts";
import type { SyntaxInventory } from "../syntax/index.ts";
import type { NativeAnalysisRun } from "./native.ts";
import {
	MEASURED_SOURCE_SETS,
	nativeAnalysisIdentity,
	nativeAnalyzerIdentity,
	nativeScope,
} from "./provenance.ts";

export function runExecutableScopeAnalysis(
	syntax: SyntaxInventory,
): NativeAnalysisRun<ExecutableScopeAnalysis> {
	const product = analyzeExecutableScopes(syntax);
	const scope = nativeScope(syntax, MEASURED_SOURCE_SETS);
	return {
		product,
		result: {
			provider: nativeAnalyzerIdentity("trellis.executable-scopes", "shared-parse"),
			state: scope.outcome.state,
			observedCoverage: scope.outcome.observedCoverage,
			...(scope.outcome.reason === undefined ? {} : { reason: scope.outcome.reason }),
			analysis: nativeAnalysisIdentity(scope, syntax.compilerVersion),
			metrics: product.metrics,
			findings: product.findings,
		},
	};
}
