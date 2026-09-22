/** First-statement Python docstrings from the shared Lezer parse. */
import type { Tree } from "@lezer/common";
import { type Node, nodeFromCursor } from "./tree.ts";

export interface PythonDocstring {
	from: number;
	to: number;
	owner: "module" | "class" | "function";
}

function firstStatement(node: Node): Node | undefined {
	const child = node.children.find(
		(part) => part.name !== ":" && part.name !== ";" && part.name !== "Comment",
	);
	if (child?.name === "StatementGroup") return firstStatement(child);
	return child;
}

function literalLeaves(node: Node, text: string): boolean {
	if (node.children.length > 0) return node.children.every((part) => literalLeaves(part, text));
	if (node.name === "(" || node.name === ")") return true;
	if (node.name !== "String") return false;
	const raw = text.slice(node.from, node.to);
	return /^(?:[rRuU]?['"])/.test(raw);
}

function docstringOf(
	node: Node,
	text: string,
	owner: PythonDocstring["owner"],
): PythonDocstring | null {
	const statement = firstStatement(node);
	if (statement?.name !== "ExpressionStatement" || !literalLeaves(statement, text)) return null;
	return { from: statement.from, to: statement.to, owner };
}

function ownedDocstring(node: Node, text: string): PythonDocstring | null {
	if (node.name === "Script") return docstringOf(node, text, "module");
	if (node.name !== "ClassDefinition" && node.name !== "FunctionDefinition") return null;
	const body = node.children.find((part) => part.name === "Body");
	return body === undefined
		? null
		: docstringOf(body, text, node.name === "ClassDefinition" ? "class" : "function");
}

/** Only a suite's first literal expression is a docstring; runtime strings stay executable. */
export function pythonDocstrings(tree: Tree, text: string): PythonDocstring[] {
	const root = nodeFromCursor(tree.cursor());
	const found: PythonDocstring[] = [];
	const visit = (node: Node): void => {
		const doc = ownedDocstring(node, text);
		if (doc !== null) found.push(doc);
		for (const child of node.children) visit(child);
	};
	visit(root);
	return found.sort((a, b) => a.from - b.from);
}
