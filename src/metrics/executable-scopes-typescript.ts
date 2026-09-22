/** Advisory TypeScript executable scopes with definition-time header ownership. */
import ts from "typescript";
import { rangeAt, type TypeScriptFileSyntax } from "../syntax/index.ts";
import { decisionsOf } from "./complexity.ts";
import {
	type ExecutableUnit,
	makeUnit,
	observeDecision,
	observeNesting,
} from "./executable-units.ts";

const CONTROL_KINDS = new Set<ts.SyntaxKind>([
	ts.SyntaxKind.IfStatement,
	ts.SyntaxKind.ForStatement,
	ts.SyntaxKind.ForInStatement,
	ts.SyntaxKind.ForOfStatement,
	ts.SyntaxKind.WhileStatement,
	ts.SyntaxKind.DoStatement,
	ts.SyntaxKind.SwitchStatement,
	ts.SyntaxKind.TryStatement,
	ts.SyntaxKind.ConditionalExpression,
]);

function className(node: ts.ClassDeclaration | ts.ClassExpression): string | null {
	if (node.name !== undefined) return node.name.text;
	const parent = node.parent;
	if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
	return null;
}

function moduleUnit(file: TypeScriptFileSyntax): ExecutableUnit {
	return makeUnit(
		file.path,
		file.sourceSet,
		"typescript",
		"module",
		"module",
		"module",
		rangeAt(file.sourceFile, 0, file.sourceFile.end),
	);
}

/** A function's body owns its decisions; defaults and decorators stay with the enclosing unit. */
export function typescriptExecutableUnits(file: TypeScriptFileSyntax): ExecutableUnit[] {
	const source = file.sourceFile;
	const units = [moduleUnit(file)];
	const functionByNode = new Map(file.functions.map((fn) => [fn.node, fn]));
	const visitClass = (
		node: ts.ClassDeclaration | ts.ClassExpression,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		const name = className(node);
		const classPath = path === null || name === null ? null : [...path, `class:${name}`];
		const classUnit = makeUnit(
			file.path,
			file.sourceSet,
			"typescript",
			"class",
			name ?? "(anonymous)",
			classPath?.join("/") ?? null,
			rangeAt(source, node.getStart(source), node.getEnd()),
			classPath === null ? "unnamed-owner" : null,
		);
		units.push(classUnit);
		const members = new Set<ts.Node>(node.members);
		ts.forEachChild(node, (child) =>
			members.has(child) ? visit(child, classUnit, classPath, 0) : visit(child, owner, path, depth),
		);
	};
	const visitFunction = (
		node: ts.Node,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		const fn = functionByNode.get(node);
		if (fn === undefined) return;
		const identified = fn.identity.state === "identified";
		const fnUnit = makeUnit(
			file.path,
			file.sourceSet,
			"typescript",
			"function",
			fn.name,
			identified ? `function:${JSON.stringify(fn.identity)}` : null,
			fn.range,
			fn.identity.state === "ambiguous" ? fn.identity.reason : null,
		);
		units.push(fnUnit);
		const fnPath = path === null || !identified ? null : [...path, `function:${fn.name}`];
		const body = (node as ts.FunctionLikeDeclaration).body;
		ts.forEachChild(node, (child) =>
			child === body ? visit(child, fnUnit, fnPath, 0) : visit(child, owner, path, depth),
		);
	};
	const visit = (
		node: ts.Node,
		owner: ExecutableUnit,
		path: readonly string[] | null,
		depth: number,
	): void => {
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			visitClass(node, owner, path, depth);
			return;
		}
		const fn = functionByNode.get(node);
		if (fn !== undefined) {
			visitFunction(node, owner, path, depth);
			return;
		}
		const control = CONTROL_KINDS.has(node.kind);
		const elseIf =
			ts.isIfStatement(node) && ts.isIfStatement(node.parent) && node.parent.elseStatement === node;
		const nextDepth = control ? (elseIf ? depth : depth + 1) : depth;
		const nodeRange = rangeAt(source, node.getStart(source), node.getEnd());
		observeDecision(owner, decisionsOf(node), nodeRange);
		if (control) observeNesting(owner, nextDepth, nodeRange);
		ts.forEachChild(node, (child) => visit(child, owner, path, nextDepth));
	};
	visit(source, units[0] ?? moduleUnit(file), [], 0);
	return units;
}
