/** First-statement Python docstrings from the shared Lezer parse. */
import type { Tree } from "@lezer/common";
import { type Node, nodeFromCursor } from "./tree.ts";

export interface PythonDocstring {
	from: number;
	to: number;
	owner: "module" | "class" | "function";
	ownerKey: string | null;
	contentSpans: readonly { from: number; to: number }[];
}

function firstStatement(node: Node): Node | undefined {
	const child = node.children.find(
		(part) => part.name !== ":" && part.name !== ";" && part.name !== "Comment",
	);
	if (child?.name === "StatementGroup") return firstStatement(child);
	return child;
}

function literalSpans(node: Node, text: string): { from: number; to: number }[] | null {
	if (node.children.length > 0) {
		const children = node.children.map((part) => literalSpans(part, text));
		return children.some((part) => part === null) ? null : children.flatMap((part) => part ?? []);
	}
	if (node.name === "(" || node.name === ")") return [];
	if (node.name !== "String" || !/^(?:[rRuU]?['"])/.test(text.slice(node.from, node.to)))
		return null;
	return [{ from: node.from, to: node.to }];
}

function docstringOf(
	node: Node,
	text: string,
	owner: PythonDocstring["owner"],
	ownerKey: string | null,
): PythonDocstring | null {
	const statement = firstStatement(node);
	if (statement?.name !== "ExpressionStatement") return null;
	const contentSpans = literalSpans(statement, text);
	if (contentSpans === null || contentSpans.length === 0) return null;
	return { from: statement.from, to: statement.to, owner, ownerKey, contentSpans };
}

function scopedName(node: Node, text: string): string | null {
	const name = node.children.find((part) => part.name === "VariableName");
	return name === undefined ? null : text.slice(name.from, name.to);
}

function ownedDocstring(
	node: Node,
	text: string,
	scope: readonly string[],
): PythonDocstring | null {
	if (node.name === "Script") return docstringOf(node, text, "module", "module");
	if (node.name !== "ClassDefinition" && node.name !== "FunctionDefinition") return null;
	const body = node.children.find((part) => part.name === "Body");
	const name = scopedName(node, text);
	const kind = node.name === "ClassDefinition" ? "class" : "function";
	return body === undefined
		? null
		: docstringOf(body, text, kind, name === null ? null : [...scope, `${kind}:${name}`].join("/"));
}

/** Only a suite's first literal expression is a docstring; runtime strings stay executable. */
export function pythonDocstrings(tree: Tree, text: string): PythonDocstring[] {
	const root = nodeFromCursor(tree.cursor());
	const found: PythonDocstring[] = [];
	const visit = (node: Node, scope: readonly string[]): void => {
		const doc = ownedDocstring(node, text, scope);
		if (doc !== null) found.push(doc);
		const name = scopedName(node, text);
		const nextScope =
			name === null || (node.name !== "ClassDefinition" && node.name !== "FunctionDefinition")
				? scope
				: [...scope, `${node.name === "ClassDefinition" ? "class" : "function"}:${name}`];
		for (const child of node.children) visit(child, nextScope);
	};
	visit(root, []);
	return found.sort((a, b) => a.from - b.from);
}
