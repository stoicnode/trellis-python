/** Guard indentation errors that Lezer recovers as syntactically valid sibling statements. */
import type { Tree } from "@lezer/common";
import type { ParseDiagnostic } from "../syntax/types.ts";

function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i += 1) if (text[i] === "\n") starts.push(i + 1);
	return starts;
}

function lineOf(starts: readonly number[], offset: number): number {
	let low = 0;
	let high = starts.length - 1;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if ((starts[mid] ?? 0) <= offset) low = mid;
		else high = mid - 1;
	}
	return low + 1;
}

function markInterior(lines: Set<number>, first: number, last: number): void {
	for (let line = first + 1; line <= last; line += 1) lines.add(line);
}

function requiresIndentedSuite(name: string, from: number, to: number, text: string): boolean {
	if (name !== "Body" && name !== "MatchBody") return false;
	const headerEnd = text.indexOf("\n", from);
	const header = text.slice(from + 1, headerEnd < 0 ? to : Math.min(headerEnd, to)).trim();
	return header === "" || header.startsWith("#");
}

function layoutLines(tree: Tree, text: string, starts: readonly number[]) {
	const suites = new Set<number>();
	const continuations = new Set<number>();
	const strings = new Set<number>();
	const cursor = tree.cursor();
	const visit = (): void => {
		const first = lineOf(starts, cursor.from);
		const last = lineOf(starts, Math.max(cursor.from, cursor.to - 1));
		if (requiresIndentedSuite(cursor.name, cursor.from, cursor.to, text)) suites.add(first);
		if (cursor.name === "String") markInterior(strings, first, last);
		if (["ArgList", "ParamList", "List", "Tuple", "Set", "Dictionary"].includes(cursor.name))
			markInterior(continuations, first, last);
		if (cursor.firstChild()) {
			do visit();
			while (cursor.nextSibling());
			cursor.parent();
		}
	};
	visit();
	return { suites, continuations, strings };
}

function diagnostic(path: string, line: number, message: string): ParseDiagnostic {
	return {
		path,
		range: { start: { line, column: 1 }, end: { line, column: 1 } },
		code: "PY-INDENT",
		message,
	};
}

function advanceIndent(indents: number[], indent: number, requiresIndent: boolean): string | null {
	const current = indents.at(-1) ?? 0;
	if (requiresIndent) {
		if (indent <= current) return "expected an indented Python block";
		indents.push(indent);
		return null;
	}
	if (indent < current) {
		while (indent < (indents.at(-1) ?? 0)) indents.pop();
		if (indent === (indents.at(-1) ?? 0)) return null;
		indents.push(indent);
		return "inconsistent Python dedent";
	}
	if (indent > current) {
		indents.push(indent);
		return "unexpected Python indentation";
	}
	return null;
}

export function pythonIndentationDiagnostics(
	path: string,
	text: string,
	tree: Tree,
): ParseDiagnostic[] {
	const starts = lineStarts(text);
	const { suites, continuations, strings } = layoutLines(tree, text, starts);
	const diagnostics: ParseDiagnostic[] = [];
	const indents = [0];
	let requiresIndent = false;
	for (const [offset, line] of text.split(/\r?\n/).entries()) {
		const lineNumber = offset + 1;
		if (strings.has(lineNumber) || continuations.has(lineNumber)) continue;
		if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
		const prefix = line.match(/^[ \t]*/)?.[0] ?? "";
		const indent = [...prefix].reduce((sum, char) => sum + (char === "\t" ? 8 : 1), 0);
		const problem = advanceIndent(indents, indent, requiresIndent);
		if (problem !== null) diagnostics.push(diagnostic(path, lineNumber, problem));
		requiresIndent = suites.has(lineNumber);
	}
	return diagnostics;
}
