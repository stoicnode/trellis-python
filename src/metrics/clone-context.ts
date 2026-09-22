/** Syntax-derived source roles for advisory clone candidate classification. */
import ts from "typescript";
import type { CloneTokenContext } from "../syntax/types.ts";

const ROLE_BY_KIND = new Map<ts.SyntaxKind, CloneTokenContext>([
	[ts.SyntaxKind.ImportDeclaration, "import-export-list"],
	[ts.SyntaxKind.ImportEqualsDeclaration, "import-export-list"],
	[ts.SyntaxKind.ExportDeclaration, "import-export-list"],
	[ts.SyntaxKind.InterfaceDeclaration, "type-declaration"],
	[ts.SyntaxKind.TypeAliasDeclaration, "type-declaration"],
	[ts.SyntaxKind.TypeLiteral, "type-declaration"],
	[ts.SyntaxKind.EnumDeclaration, "type-declaration"],
	[ts.SyntaxKind.ObjectLiteralExpression, "literal-data"],
	[ts.SyntaxKind.ArrayLiteralExpression, "literal-data"],
	[ts.SyntaxKind.JsxElement, "mixed-unknown"],
	[ts.SyntaxKind.JsxSelfClosingElement, "mixed-unknown"],
	[ts.SyntaxKind.JsxFragment, "mixed-unknown"],
]);

/** Classify a TS leaf by the nearest decisive declaration/expression ancestor. */
export function typeScriptCloneContext(node: ts.Node): CloneTokenContext {
	let current: ts.Node | undefined = node;
	while (current !== undefined) {
		const role = ROLE_BY_KIND.get(current.kind);
		if (role !== undefined) return role;
		current = current.parent;
	}
	return "executable-logic";
}
