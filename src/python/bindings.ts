/** Conservative Python binding facts from the shared Lezer parse. No code is evaluated. */
import type { Tree } from "@lezer/common";
import { firstName, fromCursor, groups, leaves, type Node, spelling } from "./binding-tree.ts";

type Binding =
	| "typing-module"
	| "type-checking"
	| "overload"
	| "importlib-module"
	| "import-module"
	| "unknown";
type Environment = Map<string, Binding>;
export type DynamicCallKind = "import-module" | "builtin-import";

export interface PythonContext {
	typeOnly: boolean;
	deferred: boolean;
	conditional: boolean;
}

export interface PythonBindingFacts {
	/** Import statement and dynamic-call offsets with their execution context. */
	contexts: ReadonlyMap<number, PythonContext>;
	/** Calls proven to use a supported import binding. */
	dynamicCalls: ReadonlyMap<number, DynamicCallKind>;
	/** Function-definition offsets carrying a confirmed typing.overload decorator. */
	overloadDeclarations: ReadonlySet<number>;
}

/** Imported bindings use exact module and imported-name spellings, never heuristics. */
function importedBinding(
	from: boolean,
	module: string,
	original: string,
	dotted: boolean,
): Binding {
	if (from) return fromImportedBinding(module, original);
	if (dotted) return "unknown";
	if (original === "typing") return "typing-module";
	if (original === "importlib") return "importlib-module";
	return "unknown";
}

function fromImportedBinding(module: string, original: string): Binding {
	if (module === "typing" && original === "TYPE_CHECKING") return "type-checking";
	if (module === "typing" && original === "overload") return "overload";
	if (module === "importlib" && original === "import_module") return "import-module";
	return "unknown";
}

function bindImportGroup(
	group: readonly Node[],
	text: string,
	environment: Environment,
	from: boolean,
	module: string,
): void {
	const names = group.filter((part) => part.name === "VariableName");
	const first = names[0];
	if (first === undefined) return;
	const original = spelling(first, text);
	const bound = group.some((part) => part.name === "as")
		? spelling(names.at(-1) ?? first, text)
		: original;
	environment.set(
		bound,
		importedBinding(
			from,
			module,
			original,
			group.some((part) => part.name === "."),
		),
	);
}

function bindImport(node: Node, text: string, environment: Environment): void {
	const parts = leaves(node);
	const from = parts[0]?.name === "from";
	const importIndex = from
		? parts.findIndex((part, index) => index > 0 && part.name === "import")
		: 0;
	if (importIndex < 0) return;
	const module = from
		? parts
				.slice(1, importIndex)
				.filter((part) => part.name === "VariableName")
				.map((part) => spelling(part, text))
				.join(".")
		: "";
	for (const group of groups(parts.slice(importIndex + 1)))
		bindImportGroup(group, text, environment, from, module);
}

function memberParts(node: Node, text: string): { object: string; property: string } | null {
	if (node.name !== "MemberExpression") return null;
	const object = node.children.find((child) => child.name === "VariableName");
	const property = node.children.find((child) => child.name === "PropertyName");
	if (object === undefined || property === undefined) return null;
	return { object: spelling(object, text), property: spelling(property, text) };
}

/** Runtime truth only for a confirmed TYPE_CHECKING expression and its negation. */
function memberRuntimeTruth(
	node: Node,
	text: string,
	environment: Environment,
): boolean | undefined {
	const member = memberParts(node, text);
	return member !== null &&
		environment.get(member.object) === "typing-module" &&
		member.property === "TYPE_CHECKING"
		? false
		: undefined;
}

function runtimeTruth(node: Node, text: string, environment: Environment): boolean | undefined {
	if (node.name === "VariableName")
		return environment.get(spelling(node, text)) === "type-checking" ? false : undefined;
	if (node.name === "MemberExpression") return memberRuntimeTruth(node, text, environment);
	return compoundRuntimeTruth(node, text, environment);
}

function compoundRuntimeTruth(
	node: Node,
	text: string,
	environment: Environment,
): boolean | undefined {
	if (node.name === "UnaryExpression" && node.children[0]?.name === "not") {
		const inner = node.children[1];
		const truth = inner === undefined ? undefined : runtimeTruth(inner, text, environment);
		return truth === undefined ? undefined : !truth;
	}
	if (node.name === "ParenthesizedExpression") {
		const inner = node.children.find((child) => child.name !== "(" && child.name !== ")");
		return inner === undefined ? undefined : runtimeTruth(inner, text, environment);
	}
	return undefined;
}

function dynamicCall(node: Node, text: string, environment: Environment): DynamicCallKind | null {
	const callee = node.children[0];
	if (callee?.name === "VariableName") {
		const name = spelling(callee, text);
		if (environment.get(name) === "import-module") return "import-module";
		if (name === "__import__" && !environment.has(name)) return "builtin-import";
	}
	if (callee === undefined) return null;
	const member = memberParts(callee, text);
	return member !== null &&
		environment.get(member.object) === "importlib-module" &&
		member.property === "import_module"
		? "import-module"
		: null;
}

function isOverloadDecorator(node: Node, text: string, environment: Environment): boolean {
	const parts = leaves(node).filter((part) => part.name !== "At");
	const name = parts.find((part) => part.name === "VariableName");
	if (name === undefined) return false;
	const property = parts.find((part) => part.name === "PropertyName");
	return property === undefined
		? environment.get(spelling(name, text)) === "overload"
		: environment.get(spelling(name, text)) === "typing-module" &&
				spelling(property, text) === "overload";
}

/** Targets of an assignment; a rebinding invalidates an imported alias. */
function assignedNames(node: Node, text: string): string[] {
	const target: Node[] = [];
	for (const child of node.children) {
		if (child.name === "AssignOp" || child.name === "UpdateOp") break;
		target.push(child);
	}
	return target
		.flatMap(leaves)
		.filter((part) => part.name === "VariableName")
		.map((part) => spelling(part, text));
}

/** Python decides a function's local names for the whole function body. */
function collectLocalNames(part: Node, root: Node, text: string, names: Set<string>): void {
	if (part !== root && (part.name === "FunctionDefinition" || part.name === "ClassDefinition")) {
		const name = firstName(part);
		if (name !== undefined) names.add(spelling(name, text));
		return;
	}
	if (part.name === "AssignStatement")
		for (const name of assignedNames(part, text)) names.add(name);
	if (part.name === "ImportStatement")
		for (const name of leaves(part).filter((leaf) => leaf.name === "VariableName"))
			names.add(spelling(name, text));
	for (const child of part.children) collectLocalNames(child, root, text, names);
}

function localNames(node: Node, text: string): Set<string> {
	const names = new Set<string>();
	collectLocalNames(node, node, text, names);
	return names;
}

function invalidateChanges(base: Environment, branches: readonly Environment[]): void {
	for (const branch of branches) {
		for (const [name, binding] of branch) {
			if (base.get(name) !== binding) base.set(name, "unknown");
		}
	}
}

interface ScanState {
	text: string;
	contexts: Map<number, PythonContext>;
	dynamicCalls: Map<number, DynamicCallKind>;
	overloadDeclarations: Set<number>;
}

function visitIf(
	node: Node,
	environment: Environment,
	context: PythonContext,
	state: ScanState,
): void {
	const branches: Environment[] = [];
	let canReachRuntime = true;
	let guard: Node | undefined;
	for (const [index, child] of node.children.entries()) {
		if (child.name === "if" || child.name === "elif") {
			guard = node.children[index + 1];
			continue;
		}
		if (child.name !== "Body") {
			visitNode(child, environment, context, state);
			continue;
		}
		const truth = guard === undefined ? undefined : runtimeTruth(guard, state.text, environment);
		branches.push(visitIfBody(child, environment, context, state, canReachRuntime, truth));
		if (truth === true) canReachRuntime = false;
		guard = undefined;
	}
	invalidateChanges(environment, branches);
}

function visitIfBody(
	body: Node,
	environment: Environment,
	context: PythonContext,
	state: ScanState,
	canReachRuntime: boolean,
	truth: boolean | undefined,
): Environment {
	const branch = new Map(environment);
	visitNode(
		body,
		branch,
		{
			...context,
			typeOnly: context.typeOnly || !canReachRuntime || truth === false,
			conditional: true,
		},
		state,
	);
	return branch;
}

function innerEnvironment(node: Node, environment: Environment, text: string): Environment {
	const inner = new Map(environment);
	if (node.name !== "FunctionDefinition") return inner;
	// A deferred body can run after a module alias is rebound. Reconfirm it locally.
	for (const [name, binding] of inner)
		if (binding === "type-checking" || binding === "typing-module") inner.set(name, "unknown");
	for (const local of localNames(node, text)) inner.set(local, "unknown");
	const parameters = node.children.find((part) => part.name === "ParamList");
	if (parameters !== undefined)
		for (const parameter of leaves(parameters).filter((part) => part.name === "VariableName"))
			inner.set(spelling(parameter, text), "unknown");
	return inner;
}

function visitDefinition(
	node: Node,
	environment: Environment,
	context: PythonContext,
	state: ScanState,
): void {
	const name = firstName(node);
	if (name !== undefined) environment.set(spelling(name, state.text), "unknown");
	for (const child of node.children) {
		if (child.name !== "Body") {
			visitNode(child, environment, context, state);
			continue;
		}
		const inner = innerEnvironment(node, environment, state.text);
		visitNode(
			child,
			inner,
			{
				...context,
				deferred: context.deferred || node.name === "FunctionDefinition",
			},
			state,
		);
	}
}

function recordOverload(node: Node, environment: Environment, state: ScanState): void {
	const definition = node.children.find((child) => child.name === "FunctionDefinition");
	if (
		definition !== undefined &&
		node.children.some(
			(child) => child.name === "Decorator" && isOverloadDecorator(child, state.text, environment),
		)
	)
		state.overloadDeclarations.add(definition.from);
}

function recordDynamicCall(
	node: Node,
	environment: Environment,
	context: PythonContext,
	state: ScanState,
): void {
	state.contexts.set(node.from, context);
	const kind = dynamicCall(node, state.text, environment);
	if (kind !== null) state.dynamicCalls.set(node.from, kind);
}

function visitAssignment(
	node: Node,
	environment: Environment,
	context: PythonContext,
	state: ScanState,
): void {
	for (const child of node.children) visitNode(child, environment, context, state);
	for (const name of assignedNames(node, state.text)) environment.set(name, "unknown");
}

function visitNode(
	node: Node,
	environment: Environment,
	context: PythonContext,
	state: ScanState,
): void {
	if (node.name === "ImportStatement") {
		state.contexts.set(node.from, context);
		bindImport(node, state.text, environment);
		return;
	}
	if (node.name === "CallExpression") recordDynamicCall(node, environment, context, state);
	if (node.name === "IfStatement") {
		visitIf(node, environment, context, state);
		return;
	}
	if (node.name === "DecoratedStatement") recordOverload(node, environment, state);
	if (node.name === "FunctionDefinition" || node.name === "ClassDefinition") {
		visitDefinition(node, environment, context, state);
		return;
	}
	if (node.name === "AssignStatement") {
		visitAssignment(node, environment, context, state);
		return;
	}
	for (const child of node.children) visitNode(child, environment, context, state);
}

/** Walk one shared parse, retaining only facts that are provable from bindings. */
export function scanPythonBindings(tree: Tree, text: string): PythonBindingFacts {
	const contexts = new Map<number, PythonContext>();
	const dynamicCalls = new Map<number, DynamicCallKind>();
	const overloadDeclarations = new Set<number>();
	visitNode(
		fromCursor(tree.cursor()),
		new Map(),
		{
			typeOnly: false,
			deferred: false,
			conditional: false,
		},
		{ text, contexts, dynamicCalls, overloadDeclarations },
	);
	return { contexts, dynamicCalls, overloadDeclarations };
}
