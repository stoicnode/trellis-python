/** Language rows are reporting facts, never score inputs. */
import type { Finding, LanguageCoverageRow } from "../contract/index.ts";
import type { SourceInventory } from "../discovery/index.ts";
import type { SyntaxInventory } from "../syntax/index.ts";

export function languageCoverage(
	source: SourceInventory,
	syntax: SyntaxInventory,
	findings: readonly Finding[],
): LanguageCoverageRow[] {
	const byPath = new Map(source.files.map((file) => [file.path, file.language]));
	const rows: LanguageCoverageRow[] = [];
	for (const language of ["python", "typescript"] as const) {
		const discovered = source.files.filter((file) => file.language === language);
		if (discovered.length === 0) continue;
		const parsed = syntax.files.filter((file) => file.language === language);
		const failures = parsed.filter((file) => file.diagnostics.length > 0);
		const unresolved = findings.filter(
			(finding) =>
				finding.kind === "graph.unresolved-import" && byPath.get(finding.path) === language,
		);
		rows.push({
			language,
			discoveredFiles: discovered.length,
			analyzedFiles: parsed.length - failures.length,
			parseFailureFiles: failures.length,
			sloc: parsed.reduce((sum, file) => sum + file.lines.code, 0),
			unresolvedImports: unresolved.length,
			dynamicImports: unresolved.filter((finding) => finding.facts?.edgeKind === "dynamic").length,
		});
	}
	return rows;
}
