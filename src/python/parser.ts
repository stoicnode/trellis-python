/**
 * Python's in-process Lezer adapter. It turns one recovered concrete tree
 * into normalized facts; no Python interpreter or project code is invoked.
 */

import type { Tree } from "@lezer/common";
import { parser } from "@lezer/python";
import { HOTSPOT_IDENTITY_VERSION, type Range, type SourceSet } from "../contract/index.ts";
import type {
	LineCounts,
	LineKind,
	NormalizedFunctionFacts,
	NormalizedToken,
	ParseDiagnostic,
} from "../syntax/types.ts";
import { pythonIndentationDiagnostics } from "./layout.ts";

/** The pinned parser identity carried by the normalized inventory. */
export const PYTHON_PARSER_VERSION = "1.1.18";

interface Node {
	name: string;
	from: number;
	to: number;
	error: boolean;
	children: Node[];
}

function nodeFromCursor(cursor: ReturnType<Tree["cursor"]>): Node {
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

function lineStarts(text: string): number[] {
	const starts = [0];
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] === "\n") starts.push(index + 1);
	}
	return starts;
}

function lineOf(starts: readonly number[], offset: number): number {
	let low = 0;
	let high = starts.length - 1;
	while (low < high) {
		const middle = (low + high + 1) >> 1;
		if ((starts[middle] ?? 0) <= offset) low = middle;
		else high = middle - 1;
	}
	return low + 1;
}

function range(starts: readonly number[], from: number, to: number): Range {
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

function mark(lines: boolean[], starts: readonly number[], from: number, to: number): void {
	const first = lineOf(starts, from) - 1;
	const last = lineOf(starts, Math.max(from, to - 1)) - 1;
	for (let line = first; line <= last; line += 1) lines[line] = true;
}

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

function ownChildren(node: Node): readonly Node[] {
	return node.children;
}

function childNamed(node: Node, name: string): Node | undefined {
	return node.children.find((child) => child.name === name);
}

function isDefaultCase(node: Node, text: string): boolean {
	if (childNamed(node, "Guard") !== undefined) return false;
	const pattern = node.children.find((child) => child.name.endsWith("Pattern"));
	return pattern !== undefined && text.slice(pattern.from, pattern.to).trim() === "_";
}

const NESTING_NODES = new Set([
	"IfStatement",
	"ForStatement",
	"WhileStatement",
	"TryStatement",
	"MatchStatement",
]);
const BRANCH_NODES = new Set([
	"IfStatement",
	"ForStatement",
	"WhileStatement",
	"ConditionalExpression",
]);

function decisionsAt(node: Node, text: string): number {
	if (BRANCH_NODES.has(node.name)) return 1;
	if (node.name === "MatchClause") return isDefaultCase(node, text) ? 0 : 1;
	if (
		node.name === "Guard" ||
		node.name === "except" ||
		node.name === "elif" ||
		node.name === "and" ||
		node.name === "or"
	)
		return 1;
	if (node.name.includes("Comprehension"))
		return node.children.filter((child) => child.name === "for" || child.name === "if").length;
	return 0;
}

function complexityOf(root: Node, text: string): { cc: number; maxNesting: number } {
	let decisions = 0;
	let maxNesting = 0;
	const visit = (node: Node, nesting: number, isRoot = false): void => {
		if (!isRoot && (node.name === "FunctionDefinition" || node.name === "LambdaExpression")) return;
		let nextNesting = nesting;
		if (NESTING_NODES.has(node.name)) {
			maxNesting = Math.max(maxNesting, nesting + 1);
			nextNesting += 1;
		}
		decisions += decisionsAt(node, text);
		for (const child of ownChildren(node)) visit(child, nextNesting);
	};
	visit(root, 0, true);
	return { cc: 1 + decisions, maxNesting };
}

function functionName(node: Node, text: string): string {
	const name = childNamed(node, "VariableName");
	return name === undefined ? "(anonymous)" : text.slice(name.from, name.to);
}

interface PendingFunction {
	fact: Omit<NormalizedFunctionFacts, "identity">;
	key: string;
}
type PythonScope = {
	kind: "class" | "function";
	name: string;
	member: "none" | "instance" | "static";
};

function appendFunction(
	node: Node,
	text: string,
	starts: readonly number[],
	lineKinds: readonly LineKind[],
	scopes: readonly PythonScope[],
	parents: readonly number[],
	member: PythonScope["member"],
	pending: PendingFunction[],
): PythonScope[] {
	const name = functionName(node, text);
	const nextScopes: PythonScope[] = [...scopes, { kind: "function", name, member }];
	const ownRange = range(starts, node.from, node.to);
	const anonymous = node.name === "LambdaExpression";
	pending.push({
		key: JSON.stringify(nextScopes),
		fact: {
			kind: anonymous ? "function-expression" : "function-declaration",
			name,
			nameOrigin: anonymous ? "anonymous" : "declared",
			range: ownRange,
			bodyRange: ownRange,
			depth: parents.length,
			parentIndex: parents.at(-1) ?? null,
			overloadSignatures: 0,
			complexity: complexityOf(node, text),
			sloc: lineKinds
				.slice(ownRange.start.line - 1, ownRange.end.line)
				.filter((kind) => kind === "code").length,
		},
	});
	return nextScopes;
}

function memberKind(scopes: readonly PythonScope[], decorators: string): PythonScope["member"] {
	if (scopes.at(-1)?.kind !== "class") return "none";
	return decorators.includes("staticmethod") ? "static" : "instance";
}

/** Inventories class, method and nested Python functions with lexical stable identities. */
export function pythonFunctions(
	tree: Tree,
	text: string,
	sourceSet: SourceSet,
	lineKinds: readonly LineKind[],
): NormalizedFunctionFacts[] {
	const starts = lineStarts(text);
	const pending: PendingFunction[] = [];
	const children = (
		node: Node,
		scopes: PythonScope[],
		parents: number[],
		decorators = "",
	): void => {
		for (const child of node.children) visit(child, scopes, parents, decorators);
	};
	const visit = (node: Node, scopes: PythonScope[], parents: number[], decorators = ""): void => {
		if (node.name === "DecoratedStatement") {
			for (const child of node.children)
				visit(child, scopes, parents, text.slice(node.from, child.from));
			return;
		}
		if (node.name === "ClassDefinition") {
			const name = functionName(node, text);
			children(node, [...scopes, { kind: "class", name, member: "none" }], parents);
			return;
		}
		if (node.name === "FunctionDefinition" || node.name === "LambdaExpression") {
			const index = pending.length;
			const scopesForIdentity = appendFunction(
				node,
				text,
				starts,
				lineKinds,
				scopes,
				parents,
				memberKind(scopes, decorators),
				pending,
			);
			children(node, scopesForIdentity, [...parents, index]);
			return;
		}
		children(node, scopes, parents);
	};
	visit(nodeFromCursor(tree.cursor()), [], []);
	const duplicate = new Set<string>();
	for (const entry of pending) {
		if (pending.filter((other) => other.key === entry.key).length > 1) duplicate.add(entry.key);
	}
	return pending.map(({ fact, key }) => {
		if (fact.nameOrigin === "anonymous" || key.includes('"(anonymous)"'))
			return {
				...fact,
				identity: { version: HOTSPOT_IDENTITY_VERSION, state: "ambiguous", reason: "anonymous" },
			};
		if (duplicate.has(key))
			return {
				...fact,
				identity: { version: HOTSPOT_IDENTITY_VERSION, state: "ambiguous", reason: "duplicate" },
			};
		const parts = JSON.parse(key) as {
			kind: "class" | "function";
			name: string;
			member: "none" | "instance" | "static";
		}[];
		const functionPart = parts.pop();
		if (functionPart === undefined)
			throw new Error("Python function identity is missing its function scope");
		return {
			...fact,
			identity: {
				version: HOTSPOT_IDENTITY_VERSION,
				state: "identified",
				sourceSet,
				scopes: parts.map((part) => ({
					kind: part.kind === "class" ? "class" : "function-declaration",
					name: part.name,
					member: part.member,
				})),
				function: {
					kind: "function-declaration",
					name: functionPart.name,
					member: functionPart.member,
				},
			},
		};
	});
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
	const diagnostics: ParseDiagnostic[] = [];
	const visit = (node: Node): void => {
		if (node.error || node.name === "⚠") {
			diagnostics.push({
				path,
				range: range(starts, node.from, Math.max(node.from + 1, node.to)),
				code: "PY-SYNTAX",
				message: "Python parser recovered from invalid syntax",
			});
		}
		for (const child of node.children) visit(child);
	};
	visit(nodeFromCursor(tree.cursor()));
	diagnostics.push(...pythonIndentationDiagnostics(path, text, tree));
	return { tree, diagnostics };
}
