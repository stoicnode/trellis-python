/**
 * AST import-site extraction from the shared TypeScript parse (SPEC §5.4).
 *
 * The inventory owns these normalized syntax facts. Graph metrics resolve and
 * measure them downstream without parsing source again.
 */
import ts from "typescript";
import type { Range } from "../contract/index.ts";
import { rangeAt } from "./parse.ts";

/** The syntactic kind of an import site. */
export type ImportSiteKind = "import" | "re-export" | "dynamic";

/** One raw import site found in the shared parse, before resolution. */
export interface ImportSite {
	kind: ImportSiteKind;
	typeOnly: boolean;
	/** Python static execution context when the binding pass can classify it. */
	execution?: { deferred: boolean; conditional: boolean };
	/** The specifier as written; `null` for a non-literal dynamic import. */
	specifier: string | null;
	/** 1-based range of the specifier (of the argument expression when non-literal). */
	range: Range;
	/** Python-only syntax facts used by the Python graph resolver. */
	python?: {
		form: "import" | "from" | "dynamic";
		/** Dotted module name; `null` for a non-literal dynamic import. */
		module: string | null;
		/** Leading-dot count for `from ... import ...`; zero for absolute imports. */
		level: number;
		/** Imported names without aliases; `*` records a star import. */
		imported: string[];
		/** Literal package argument for a relative Python dynamic import. */
		packageName?: string | null;
	};
}

/** Site plus the sort key (node start) used to restore source order. */
interface LocatedSite {
	start: number;
	site: ImportSite;
}

/** Range of a string-literal specifier node, excluding the quotes. */
function specifierRange(sourceFile: ts.SourceFile, literal: ts.StringLiteralLike): Range {
	return rangeAt(sourceFile, literal.getStart() + 1, literal.end - 1);
}

/** Site for a static `import … from "s"` or bare `import "s"` declaration. */
function importDeclarationSite(
	sourceFile: ts.SourceFile,
	node: ts.ImportDeclaration,
): LocatedSite | null {
	if (!ts.isStringLiteral(node.moduleSpecifier)) return null;
	return {
		start: node.getStart(),
		site: {
			kind: "import",
			typeOnly: node.importClause?.isTypeOnly ?? false,
			specifier: node.moduleSpecifier.text,
			range: specifierRange(sourceFile, node.moduleSpecifier),
		},
	};
}

/** Site for a TS import-equals (`import x = require("s")`); entity-name references are not module edges. */
function importEqualsSite(
	sourceFile: ts.SourceFile,
	node: ts.ImportEqualsDeclaration,
): LocatedSite | null {
	const ref = node.moduleReference;
	if (!ts.isExternalModuleReference(ref) || !ts.isStringLiteralLike(ref.expression)) return null;
	return {
		start: node.getStart(),
		site: {
			kind: "import",
			typeOnly: node.isTypeOnly,
			specifier: ref.expression.text,
			range: specifierRange(sourceFile, ref.expression),
		},
	};
}

/** Site for an `export … from "s"` re-export; `export { … }` (no module) is not an edge. */
function exportDeclarationSite(
	sourceFile: ts.SourceFile,
	node: ts.ExportDeclaration,
): LocatedSite | null {
	if (node.moduleSpecifier === undefined || !ts.isStringLiteral(node.moduleSpecifier)) return null;
	return {
		start: node.getStart(),
		site: {
			kind: "re-export",
			typeOnly: node.isTypeOnly,
			specifier: node.moduleSpecifier.text,
			range: specifierRange(sourceFile, node.moduleSpecifier),
		},
	};
}

/** Site for a value-position `import(…)` call; only literal arguments carry a specifier. */
function dynamicImportSite(sourceFile: ts.SourceFile, node: ts.CallExpression): LocatedSite {
	const argument = node.arguments[0];
	const literal = argument !== undefined && ts.isStringLiteralLike(argument) ? argument : null;
	return {
		start: node.getStart(),
		site: {
			kind: "dynamic",
			typeOnly: false,
			specifier: literal?.text ?? null,
			range:
				literal !== null
					? specifierRange(sourceFile, literal)
					: rangeAt(sourceFile, argument?.getStart() ?? node.getStart(), argument?.end ?? node.end),
		},
	};
}

/** Site for a type-position `import("s").T` type node (always a type-only edge). */
function importTypeSite(sourceFile: ts.SourceFile, node: ts.ImportTypeNode): LocatedSite | null {
	const argument = node.argument;
	if (!ts.isLiteralTypeNode(argument) || !ts.isStringLiteralLike(argument.literal)) return null;
	return {
		start: node.getStart(),
		site: {
			kind: "import",
			typeOnly: true,
			specifier: argument.literal.text,
			range: specifierRange(sourceFile, argument.literal),
		},
	};
}

/** Collect every import site of one parsed file, in source order. */
export function collectImportSites(sourceFile: ts.SourceFile): ImportSite[] {
	const sites: LocatedSite[] = [];
	const declarationSite = (node: ts.Node): LocatedSite | null => {
		if (ts.isImportDeclaration(node)) return importDeclarationSite(sourceFile, node);
		if (ts.isImportEqualsDeclaration(node)) return importEqualsSite(sourceFile, node);
		if (ts.isExportDeclaration(node)) return exportDeclarationSite(sourceFile, node);
		return null;
	};
	const nestedSite = (node: ts.Node): LocatedSite | null => {
		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
			return dynamicImportSite(sourceFile, node);
		}
		return ts.isImportTypeNode(node) ? importTypeSite(sourceFile, node) : null;
	};
	const visit = (node: ts.Node): void => {
		const site = declarationSite(node) ?? nestedSite(node);
		if (site !== null) sites.push(site);
		ts.forEachChild(node, visit);
	};
	ts.forEachChild(sourceFile, visit);
	return sites.sort((a, b) => a.start - b.start).map((located) => located.site);
}
