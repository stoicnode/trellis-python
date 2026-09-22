/** Attached TypeScript/TSX JSDoc blocks from the shared compiler AST. */
import ts from "typescript";
import type { TypeScriptFileSyntax } from "../syntax/index.ts";

export interface TypeScriptDocBlock {
	from: number;
	to: number;
	raw: string;
	ownerKey: string | null;
}

function declarationName(node: ts.Node, source: ts.SourceFile): string | null {
	if (ts.isConstructorDeclaration(node)) return "constructor";
	if (ts.isVariableStatement(node)) {
		const declarations = node.declarationList.declarations;
		return declarations.length === 1 ? (declarations[0]?.name.getText(source) ?? null) : null;
	}
	return namedNode(node, source);
}

function namedNode(node: ts.Node, source: ts.SourceFile): string | null {
	if (
		ts.isClassDeclaration(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isModuleDeclaration(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isPropertyDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	)
		return node.name?.getText(source) ?? null;
	return null;
}

function ownerKey(node: ts.Node, source: ts.SourceFile): string | null {
	const parts: string[] = [];
	let current: ts.Node | undefined = node;
	while (current !== undefined && current !== source) {
		const name = declarationName(current, source);
		if (current === node && name === null) return null;
		if (name !== null) parts.push(`${ts.SyntaxKind[current.kind]}:${name}`);
		current = current.parent;
	}
	return parts.length === 0 ? null : parts.reverse().join("/");
}

/** Exact source spans and stable named owners; detached comments are excluded. */
export function attachedTypeScriptDocs(file: TypeScriptFileSyntax): TypeScriptDocBlock[] {
	const source = file.sourceFile;
	const seen = new Set<string>();
	const found: TypeScriptDocBlock[] = [];
	const visit = (node: ts.Node): void => {
		const docs = (node as ts.Node & { jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? [];
		for (const doc of docs) {
			const key = `${doc.pos}:${doc.end}`;
			if (seen.has(key)) continue;
			seen.add(key);
			found.push({
				from: doc.pos,
				to: doc.end,
				raw: source.text.slice(doc.pos, doc.end),
				ownerKey: ownerKey(node, source),
			});
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found.sort((a, b) => a.from - b.from);
}
