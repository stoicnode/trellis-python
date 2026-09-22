/** Python function inventory over the one shared Lezer parse. */
import type { Tree } from "@lezer/common";
import { HOTSPOT_IDENTITY_VERSION, type SourceSet } from "../contract/index.ts";
import type { LineKind, NormalizedFunctionFacts, OrphanOverload } from "../syntax/types.ts";
import { scanPythonBindings } from "./bindings.ts";
import { lineStarts, type Node, nodeFromCursor, range } from "./tree.ts";

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
export interface PythonFunctionInventory {
	functions: NormalizedFunctionFacts[];
	signatureCount: number;
	orphanOverloads: OrphanOverload[];
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
	overloadSignatures: number,
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
			overloadSignatures,
			complexity: complexityOf(node, text),
			sloc: lineKinds
				.slice(ownRange.start.line - 1, ownRange.end.line)
				.filter((kind) => kind === "code").length,
		},
	});
	return nextScopes;
}

function overloadKey(
	node: Node,
	text: string,
	scopes: readonly PythonScope[],
	member: PythonScope["member"],
): string {
	return JSON.stringify([...scopes, { kind: "function", name: functionName(node, text), member }]);
}

interface PendingOverload extends OrphanOverload {
	branch: string;
}

function takeOverloads(
	signatures: Map<string, PendingOverload[]>,
	key: string,
	branch: string,
): PendingOverload[] {
	const candidates = signatures.get(key) ?? [];
	const matching = candidates.filter(
		(candidate) => candidate.branch === branch || candidate.branch.startsWith(`${branch}/`),
	);
	const remaining = candidates.filter((candidate) => !matching.includes(candidate));
	if (remaining.length === 0) signatures.delete(key);
	else signatures.set(key, remaining);
	return matching;
}

const CONDITIONAL_NODES = new Set(["IfStatement", "TryStatement", "MatchStatement"]);

function memberKind(scopes: readonly PythonScope[], decorators: string): PythonScope["member"] {
	if (scopes.at(-1)?.kind !== "class") return "none";
	return decorators.includes("staticmethod") ? "static" : "instance";
}

/** Inventories executable definitions and confirmed overload declarations on one parse. */
export function pythonFunctionInventory(
	tree: Tree,
	text: string,
	_sourceSet: SourceSet,
	lineKinds: readonly LineKind[],
): PythonFunctionInventory {
	const starts = lineStarts(text);
	const pending: PendingFunction[] = [];
	const declarations = scanPythonBindings(tree, text).overloadDeclarations;
	const signatures = new Map<string, PendingOverload[]>();
	const children = (
		node: Node,
		scopes: PythonScope[],
		parents: number[],
		decorators = "",
		branch = "",
	): void => {
		for (const child of node.children) {
			const nextBranch =
				CONDITIONAL_NODES.has(node.name) && child.name === "Body"
					? `${branch}/${node.from}:${child.from}`
					: branch;
			visit(child, scopes, parents, decorators, nextBranch);
		}
	};
	const visit = (
		node: Node,
		scopes: PythonScope[],
		parents: number[],
		decorators = "",
		branch = "",
	): void => {
		if (node.name === "DecoratedStatement") {
			for (const child of node.children)
				visit(child, scopes, parents, text.slice(node.from, child.from), branch);
			return;
		}
		if (node.name === "ClassDefinition") {
			const name = functionName(node, text);
			children(node, [...scopes, { kind: "class", name, member: "none" }], parents, "", branch);
			return;
		}
		if (node.name === "FunctionDefinition" || node.name === "LambdaExpression") {
			const member = memberKind(scopes, decorators);
			const key = overloadKey(node, text, scopes, member);
			if (declarations.has(node.from)) {
				const previous = signatures.get(key) ?? [];
				previous.push({
					name: functionName(node, text),
					range: range(starts, node.from, node.to),
					scope: key,
					branch,
				});
				signatures.set(key, previous);
				return;
			}
			const overloads = takeOverloads(signatures, key, branch);
			const index = pending.length;
			const scopesForIdentity = appendFunction(
				node,
				text,
				starts,
				lineKinds,
				scopes,
				parents,
				member,
				overloads.length,
				pending,
			);
			children(node, scopesForIdentity, [...parents, index], "", branch);
			return;
		}
		children(node, scopes, parents, "", branch);
	};
	visit(nodeFromCursor(tree.cursor()), [], []);
	const duplicate = new Set<string>();
	for (const entry of pending) {
		if (pending.filter((other) => other.key === entry.key).length > 1) duplicate.add(entry.key);
	}
	const functions = pending.map(({ fact, key }): NormalizedFunctionFacts => {
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
	return {
		functions,
		signatureCount: declarations.size,
		orphanOverloads: [...signatures.values()]
			.flat()
			.sort((a, b) => a.range.start.line - b.range.start.line),
	};
}

/** Backward-compatible direct function facts view. */
export function pythonFunctions(
	tree: Tree,
	text: string,
	sourceSet: SourceSet,
	lineKinds: readonly LineKind[],
): NormalizedFunctionFacts[] {
	return pythonFunctionInventory(tree, text, sourceSet, lineKinds).functions;
}
