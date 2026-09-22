/** Advisory Python executable scopes with definition-time header ownership. */

import { decisionsAt } from "../python/function-inventory.ts";
import { lineStarts, type Node, nodeFromCursor, range } from "../python/tree.ts";
import type { PythonFileSyntax } from "../syntax/types.ts";
import {
	type ExecutableUnit,
	makeUnit,
	observeDecision,
	observeNesting,
} from "./executable-units.ts";

const CONTROL_NODES = new Set([
	"IfStatement",
	"ForStatement",
	"WhileStatement",
	"TryStatement",
	"MatchStatement",
	"ConditionalExpression",
]);

function isControl(node: Node): boolean {
	return CONTROL_NODES.has(node.name) || node.name.endsWith("ComprehensionExpression");
}

function rangeKey(node: Node, starts: readonly number[]): string {
	const span = range(starts, node.from, node.to);
	return `${span.start.line}:${span.start.column}:${span.end.line}:${span.end.column}`;
}

function functionBody(node: Node): Node | undefined {
	const suite = node.children.find((child) => child.name === "Body");
	if (suite !== undefined) return suite;
	if (node.name !== "LambdaExpression") return undefined;
	const colon = node.children.findIndex((child) => child.name === ":");
	return colon < 0 ? undefined : node.children[colon + 1];
}

function className(node: Node, text: string): string | null {
	const name = node.children.find((child) => child.name === "VariableName");
	return name === undefined ? null : text.slice(name.from, name.to);
}

/** Nested function bodies are isolated; defaults/decorators belong to the defining scope. */
export function pythonExecutableUnits(file: PythonFileSyntax): ExecutableUnit[] {
	const text = file.text ?? "";
	const starts = lineStarts(text);
	const module = makeUnit(
		file.path,
		file.sourceSet,
		"python",
		"module",
		"module",
		"module",
		range(starts, 0, text.length),
	);
	const units = [module];
	const functionByRange = new Map(
		file.functions.map((fn) => [
			`${fn.range.start.line}:${fn.range.start.column}:${fn.range.end.line}:${fn.range.end.column}`,
			fn,
		]),
	);
	const visitClass = (
		node: Node,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		const name = className(node, text);
		const classPath = path === null || name === null ? null : [...path, `class:${name}`];
		const classUnit = makeUnit(
			file.path,
			file.sourceSet,
			"python",
			"class",
			name ?? "(anonymous)",
			classPath?.join("/") ?? null,
			range(starts, node.from, node.to),
			classPath === null ? "unnamed-owner" : null,
		);
		units.push(classUnit);
		for (const child of node.children)
			child.name === "Body"
				? visit(child, classUnit, classPath, 0)
				: visit(child, owner, path, depth);
	};
	const visitUninventoriedFunction = (
		node: Node,
		body: Node | undefined,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		for (const child of node.children) {
			if (child !== body) visit(child, owner, path, depth);
		}
	};
	const visitFunction = (
		node: Node,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		const fn = functionByRange.get(rangeKey(node, starts));
		const body = functionBody(node);
		if (fn === undefined) {
			visitUninventoriedFunction(node, body, owner, path, depth);
			return;
		}
		const identified = fn.identity.state === "identified";
		const fnUnit = makeUnit(
			file.path,
			file.sourceSet,
			"python",
			"function",
			fn.name,
			identified ? `function:${JSON.stringify(fn.identity)}` : null,
			fn.range,
			fn.identity.state === "ambiguous" ? fn.identity.reason : null,
		);
		units.push(fnUnit);
		const fnPath = path === null || !identified ? null : [...path, `function:${fn.name}`];
		for (const child of node.children)
			child === body ? visit(child, fnUnit, fnPath, 0) : visit(child, owner, path, depth);
	};
	const visit = (
		node: Node,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		if (node.name === "ClassDefinition") {
			visitClass(node, owner, path, depth);
			return;
		}
		if (node.name === "FunctionDefinition" || node.name === "LambdaExpression") {
			visitFunction(node, owner, path, depth);
			return;
		}
		const control = isControl(node);
		const elif =
			node.name === "IfStatement" &&
			text.slice(node.from, Math.min(node.from + 5, node.to)).startsWith("elif ");
		const nextDepth = control ? (elif ? depth : depth + 1) : depth;
		const nodeRange = range(starts, node.from, node.to);
		observeDecision(owner, decisionsAt(node, text), nodeRange);
		if (control) observeNesting(owner, nextDepth, nodeRange);
		for (const child of node.children) visit(child, owner, path, nextDepth);
	};
	visit(nodeFromCursor(file.parserTree.cursor()), module, [], 0);
	return units;
}
