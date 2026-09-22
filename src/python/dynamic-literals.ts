/** Provable Python dynamic-import literals from the shared Lezer call node. */

import type { Node } from "./binding-tree.ts";
import type { DynamicCallKind } from "./bindings.ts";

export interface PythonDynamicLiteral {
	specifier: string;
	module: string;
	level: number;
	packageName: string | null;
	from: number;
	to: number;
}

interface LiteralArgument {
	name: string | null;
	value: string;
	from: number;
	to: number;
}

function literalString(node: Node, text: string): Omit<LiteralArgument, "name"> | null {
	if (node.name !== "String") return null;
	const raw = text.slice(node.from, node.to);
	const prefix = /^[rRuU]/.test(raw) ? 1 : 0;
	const quote = raw[prefix];
	if (quote !== "'" && quote !== '"') return null;
	const width = raw.slice(prefix, prefix + 3) === quote.repeat(3) ? 3 : 1;
	if (!raw.endsWith(quote.repeat(width))) return null;
	const value = raw.slice(prefix + width, -width);
	if (value.includes("\\") || value.includes("\n") || value.includes("\r")) return null;
	return { value, from: node.from + prefix + width, to: node.to - width };
}

function argumentGroups(call: Node): Node[][] {
	const list = call.children.find((child) => child.name === "ArgList");
	if (list === undefined) return [];
	const groups: Node[][] = [[]];
	for (const child of list.children) {
		if (child.name === "(" || child.name === ")") continue;
		if (child.name === ",") groups.push([]);
		else groups.at(-1)?.push(child);
	}
	return groups.filter((group) => group.length > 0);
}

function parseArgument(nodes: readonly Node[], text: string): LiteralArgument | null {
	if (nodes.length === 1) {
		const literal = nodes[0] === undefined ? null : literalString(nodes[0], text);
		return literal === null ? null : { name: null, ...literal };
	}
	return parseKeywordArgument(nodes, text);
}

function parseKeywordArgument(nodes: readonly Node[], text: string): LiteralArgument | null {
	const [name, assign, value] = nodes;
	if (nodes.length !== 3 || name?.name !== "VariableName" || assign?.name !== "AssignOp")
		return null;
	const literal = value === undefined ? null : literalString(value, text);
	return literal === null ? null : { name: text.slice(name.from, name.to), ...literal };
}

function callArguments(call: Node, text: string): LiteralArgument[] | null {
	const groups = argumentGroups(call);
	const args = groups.map((group) => parseArgument(group, text));
	return args.some((arg) => arg === null) ? null : (args as LiteralArgument[]);
}

const MODULE_NAME = /^[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*$/;

function validModule(value: string, relative: boolean): boolean {
	const suffix = value.replace(/^\.+/, "");
	return relative ? suffix === "" || MODULE_NAME.test(suffix) : MODULE_NAME.test(value);
}

function namedArgument(
	args: readonly LiteralArgument[],
	position: number,
	name: string,
): LiteralArgument | null {
	const positional = args.filter((arg) => arg.name === null);
	const named = args.filter((arg) => arg.name === name);
	if (named.length > 1 || (named.length > 0 && positional[position] !== undefined)) return null;
	return named[0] ?? positional[position] ?? null;
}

function supportedArgs(args: readonly LiteralArgument[], kind: DynamicCallKind): boolean {
	if (kind === "builtin-import") return args.length === 1 && args[0]?.name !== "package";
	return (
		args.length <= 2 &&
		args.every((arg) => arg.name === null || arg.name === "name" || arg.name === "package")
	);
}

function packageArgument(
	args: readonly LiteralArgument[],
	kind: DynamicCallKind,
): LiteralArgument | null {
	return kind === "import-module" ? namedArgument(args, 1, "package") : null;
}

function hasValidPackage(packageArg: LiteralArgument | null, level: number): boolean {
	return level === 0 || (packageArg !== null && MODULE_NAME.test(packageArg.value));
}

/** Only supported call signatures and physical plain string literals produce a target. */
export function pythonDynamicLiteral(
	call: Node,
	text: string,
	kind: DynamicCallKind,
): PythonDynamicLiteral | null {
	const args = callArguments(call, text);
	if (args === null || args.length === 0 || !supportedArgs(args, kind)) return null;
	return literalTarget(args, kind);
}

function literalTarget(
	args: readonly LiteralArgument[],
	kind: DynamicCallKind,
): PythonDynamicLiteral | null {
	const name = namedArgument(args, 0, "name");
	if (name === null) return null;
	const level = name.value.match(/^\.+/)?.[0].length ?? 0;
	if (!validModule(name.value, level > 0)) return null;
	if (kind === "builtin-import" && level > 0) return null;
	const packageArg = packageArgument(args, kind);
	if (!hasValidPackage(packageArg, level)) return null;
	return {
		specifier: name.value,
		module: name.value.slice(level),
		level,
		packageName: packageArg?.value ?? null,
		from: name.from,
		to: name.to,
	};
}
