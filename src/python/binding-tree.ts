/** Small Lezer-tree view shared by Python binding analysis. */
import type { Tree } from "@lezer/common";

export interface Node {
	name: string;
	from: number;
	to: number;
	children: Node[];
}

export function fromCursor(cursor: ReturnType<Tree["cursor"]>): Node {
	const node: Node = { name: cursor.name, from: cursor.from, to: cursor.to, children: [] };
	if (cursor.firstChild()) {
		do node.children.push(fromCursor(cursor));
		while (cursor.nextSibling());
		cursor.parent();
	}
	return node;
}

export function leaves(node: Node): Node[] {
	return node.children.length === 0 ? [node] : node.children.flatMap(leaves);
}

export function spelling(node: Node, text: string): string {
	return text.slice(node.from, node.to);
}

export function firstName(node: Node): Node | undefined {
	return node.children.find((child) => child.name === "VariableName");
}

export function groups(nodes: readonly Node[]): Node[][] {
	const result: Node[][] = [[]];
	for (const node of nodes) {
		if (node.name === ",") result.push([]);
		else result.at(-1)?.push(node);
	}
	return result;
}
