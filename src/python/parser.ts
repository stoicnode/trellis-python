/**
 * Python's in-process Lezer adapter. It turns one recovered concrete tree
 * into normalized facts; no Python interpreter or project code is invoked.
 */
import type { Tree } from "@lezer/common";
import type { LineCounts, LineKind, NormalizedToken, ParseDiagnostic } from "../syntax/types.ts";
import { parser } from "./grammar/trellis-parser.ts";
import { pythonIndentationDiagnostics } from "./layout.ts";
import { lineOf, lineStarts, mark, type Node, nodeFromCursor, range } from "./tree.ts";

export { pythonFunctions } from "./function-inventory.ts";

import { isTriviaRecovery } from "./trivia-recovery.ts";

/** The pinned parser identity carried by the normalized inventory. */
export const PYTHON_PARSER_VERSION = "1.1.18-trellis.2";

/** Token-derived line classification shared by complexity and clone accounting. */
export function pythonLineKinds(
	tree: Tree,
	text: string,
): { kinds: LineKind[]; lines: LineCounts } {
	const starts = lineStarts(text);
	const code = Array.from({ length: starts.length }, () => false);
	const comments = Array.from({ length: starts.length }, () => false);
	const visit = (node: Node): void => {
		if (node.children.length === 0) {
			if (node.name === "Comment") mark(comments, starts, node.from, node.to);
			else if (!node.error && node.name !== "⚠") mark(code, starts, node.from, node.to);
			return;
		}
		for (const child of node.children) visit(child);
	};
	visit(nodeFromCursor(tree.cursor()));
	const kinds = code.map((isCode, index) =>
		isCode ? "code" : comments[index] ? "commentOnly" : "blank",
	);
	return {
		kinds,
		lines: {
			total: kinds.length,
			code: kinds.filter((kind) => kind === "code").length,
			commentOnly: kinds.filter((kind) => kind === "commentOnly").length,
			blank: kinds.filter((kind) => kind === "blank").length,
		},
	};
}

function tokenKind(name: string, text: string): number {
	if (name === "VariableName" || name === "PropertyName") return 0x40000001;
	if (name === "Number" || name === "String" || name.includes("String")) return 0x40000002;
	let hash = 2166136261;
	const identity =
		name === "ArithOp" || name === "CompareOp" || name === "LogicOp" ? `${name}:${text}` : name;
	for (let index = 0; index < identity.length; index += 1)
		hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619);
	return 0x40000000 + ((hash >>> 0) % 0x3fffffff);
}

/** A disjoint Python token alphabet. Body markers preserve suite boundaries absent from leaf tokens. */
export function pythonTokens(
	tree: Tree,
	text: string,
	onToken: () => void = () => {},
): NormalizedToken[] {
	const starts = lineStarts(text);
	const tokens: NormalizedToken[] = [];
	const emit = (token: NormalizedToken): void => {
		onToken();
		tokens.push(token);
	};
	const visit = (node: Node): void => {
		if (node.name === "Body" || node.name === "MatchBody") {
			emit({
				kind: 0x3fffffff,
				startLine: lineOf(starts, node.from),
				endLine: lineOf(starts, node.from),
			});
		}
		if (node.children.length === 0) {
			if (node.name !== "Comment" && !node.error && node.name !== "⚠") {
				emit({
					kind: tokenKind(node.name, text.slice(node.from, node.to)),
					startLine: lineOf(starts, node.from),
					endLine: lineOf(starts, Math.max(node.from, node.to - 1)),
				});
			}
			return;
		}
		for (const child of node.children) visit(child);
		if (node.name === "Body" || node.name === "MatchBody")
			emit({
				kind: 0x3ffffffe,
				startLine: lineOf(starts, node.to),
				endLine: lineOf(starts, node.to),
			});
	};
	visit(nodeFromCursor(tree.cursor()));
	return tokens;
}

/** One deterministic Python parse, with recovery errors converted to located diagnostics. */
export function parsePython(
	path: string,
	text: string,
): {
	tree: Tree;
	diagnostics: ParseDiagnostic[];
} {
	const tree = parser.parse(text);
	const starts = lineStarts(text);
	const root = nodeFromCursor(tree.cursor());
	const errors: Node[] = [];
	const visit = (node: Node): void => {
		if (node.error || node.name === "⚠") errors.push(node);
		for (const child of node.children) visit(child);
	};
	visit(root);
	const layout = pythonIndentationDiagnostics(path, text, tree);
	const recoveredTrivia =
		errors.length === 1 && layout.length === 0 && isTriviaRecovery(root, errors[0] ?? root, text);
	const diagnostics: ParseDiagnostic[] = (recoveredTrivia ? [] : errors).map((node) => ({
		path,
		range: range(starts, node.from, Math.max(node.from + 1, node.to)),
		code: "PY-SYNTAX",
		message: "Python parser recovered from invalid syntax",
	}));
	diagnostics.push(...layout);
	return { tree, diagnostics };
}
