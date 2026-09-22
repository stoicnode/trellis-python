/** Shared, read-only Python Lezer tree and source coordinates. */
import type { Tree } from "@lezer/common";
import type { Range } from "../contract/index.ts";

export interface Node {
	name: string;
	from: number;
	to: number;
	error: boolean;
	children: Node[];
}

export function nodeFromCursor(cursor: ReturnType<Tree["cursor"]>): Node {
	const node: Node = {
		name: cursor.name,
		from: cursor.from,
		to: cursor.to,
		error: cursor.type.isError,
		children: [],
	};
	if (cursor.firstChild()) {
		do node.children.push(nodeFromCursor(cursor));
		while (cursor.nextSibling());
		cursor.parent();
	}
	return node;
}

export function lineStarts(text: string): number[] {
	const starts = [0];
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] === "\n") starts.push(index + 1);
	}
	return starts;
}

export function lineOf(starts: readonly number[], offset: number): number {
	let low = 0;
	let high = starts.length - 1;
	while (low < high) {
		const middle = (low + high + 1) >> 1;
		if ((starts[middle] ?? 0) <= offset) low = middle;
		else high = middle - 1;
	}
	return low + 1;
}

export function range(starts: readonly number[], from: number, to: number): Range {
	return {
		start: {
			line: lineOf(starts, from),
			column: from - (starts[lineOf(starts, from) - 1] ?? 0) + 1,
		},
		end: {
			line: lineOf(starts, Math.max(from, to - 1)),
			column: to - (starts[lineOf(starts, Math.max(from, to - 1)) - 1] ?? 0) + 1,
		},
	};
}

export function mark(lines: boolean[], starts: readonly number[], from: number, to: number): void {
	const first = lineOf(starts, from) - 1;
	const last = lineOf(starts, Math.max(from, to - 1)) - 1;
	for (let line = first; line <= last; line += 1) lines[line] = true;
}
