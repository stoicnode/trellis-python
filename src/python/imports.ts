/** Python import-site extraction from the shared @lezer/python tree. */
import type { Tree, TreeCursor } from "@lezer/common";
import type { Range } from "../contract/index.ts";
import type { ImportSite } from "../syntax/import-sites.ts";
import { fromCursor } from "./binding-tree.ts";
import { type DynamicCallKind, scanPythonBindings } from "./bindings.ts";
import { pythonDynamicLiteral } from "./dynamic-literals.ts";

interface Leaf {
	name: string;
	from: number;
	to: number;
}

interface LocatedSite {
	start: number;
	site: ImportSite;
}

/** Convert a Lezer UTF-16 offset into the shared, one-based range contract. */
function positionAt(text: string, offset: number): { line: number; column: number } {
	let line = 1;
	let column = 1;
	for (let index = 0; index < offset; index += 1) {
		if (text[index] === "\n") {
			line += 1;
			column = 1;
		} else {
			column += 1;
		}
	}
	return { line, column };
}

function rangeAt(text: string, from: number, to: number): Range {
	return { start: positionAt(text, from), end: positionAt(text, to) };
}

/** Flatten a subtree into grammar leaves; comments and whitespace are absent from Lezer's tree. */
function leaves(cursor: TreeCursor): Leaf[] {
	const found: Leaf[] = [];
	const visit = (): void => {
		if (!cursor.firstChild()) {
			found.push({ name: cursor.name, from: cursor.from, to: cursor.to });
			return;
		}
		do visit();
		while (cursor.nextSibling());
		cursor.parent();
	};
	visit();
	return found;
}

function moduleFrom(
	text: string,
	leaves: readonly Leaf[],
): { module: string; from: number; to: number } | null {
	const names = leaves.filter((leaf) => leaf.name === "VariableName");
	const first = names[0];
	const last = names.at(-1);
	if (first === undefined || last === undefined) return null;
	return {
		module: names.map((leaf) => leafText(text, leaf)).join("."),
		from: first.from,
		to: last.to,
	};
}

function leafText(text: string, leaf: Leaf): string {
	return text.slice(leaf.from, leaf.to);
}

function importedNames(text: string, leaves: readonly Leaf[]): string[] {
	const names: string[] = [];
	let aliases = false;
	for (const leaf of leaves) {
		if (leaf.name === ",") {
			aliases = false;
			continue;
		}
		if (leaf.name === "as") {
			aliases = true;
			continue;
		}
		if (leaf.name === "*" && !names.includes("*")) names.push("*");
		if (leaf.name === "VariableName" && !aliases) names.push(leafText(text, leaf));
	}
	return names;
}

function fromModuleParts(parts: readonly Leaf[], text: string, from: number) {
	const importIndex = parts.findIndex((leaf) => leaf.name === "import" && leaf.from !== from);
	if (importIndex < 0) return null;
	const moduleParts = parts.slice(1, importIndex);
	let level = 0;
	for (const leaf of moduleParts) {
		if (leaf.name === ".") {
			level += 1;
			continue;
		}
		if (leaf.name === "Ellipsis") {
			level += 3;
			continue;
		}
		break;
	}
	const module = moduleFrom(text, moduleParts);
	const anchor = module ?? moduleParts[0];
	if (anchor === undefined) return null;
	return { module, anchor, level, imported: importedNames(text, parts.slice(importIndex + 1)) };
}

function fromImportSites(text: string, cursor: TreeCursor, typeOnly: boolean): LocatedSite[] {
	const detail = fromModuleParts(leaves(cursor), text, cursor.from);
	if (detail === null) return [];
	const { module, anchor, level, imported } = detail;
	return (imported.length === 0 ? [[]] : imported.map((name) => [name])).map((name) => ({
		start: cursor.from,
		site: {
			kind: "import",
			typeOnly,
			specifier: module?.module ?? ".".repeat(level),
			range: rangeAt(text, module?.from ?? anchor.from, module?.to ?? anchor.to),
			python: { form: "from", module: module?.module ?? "", level, imported: name },
		},
	}));
}

function dynamicArgument(parts: readonly Leaf[]): Leaf | undefined {
	const open = parts.findIndex((leaf) => leaf.name === "(");
	return parts
		.slice(open + 1)
		.find((leaf) => leaf.name === "String" || leaf.name === "VariableName");
}

function plainImportSites(text: string, cursor: TreeCursor, typeOnly: boolean): LocatedSite[] {
	const parts = leaves(cursor).slice(1);
	const sites: LocatedSite[] = [];
	let current: Leaf[] = [];
	let aliases = false;
	const flush = (): void => {
		const module = moduleFrom(text, current);
		if (module !== null) {
			sites.push({
				start: module.from,
				site: {
					kind: "import",
					typeOnly,
					specifier: module.module,
					range: rangeAt(text, module.from, module.to),
					python: { form: "import", module: module.module, level: 0, imported: [] },
				},
			});
		}
		current = [];
		aliases = false;
	};
	for (const leaf of parts) {
		if (leaf.name === ",") {
			flush();
			continue;
		}
		if (leaf.name === "as") {
			aliases = true;
			continue;
		}
		if (leaf.name === "VariableName" && !aliases) current.push(leaf);
	}
	flush();
	return sites;
}

function callDynamicSite(
	text: string,
	cursor: TreeCursor,
	typeOnly: boolean,
	kind: DynamicCallKind,
	execution: ImportSite["execution"],
): LocatedSite {
	const literal = pythonDynamicLiteral(fromCursor(cursor), text, kind);
	const arg = literal === null ? dynamicArgument(leaves(cursor)) : undefined;
	const position = dynamicPosition(text, cursor, literal, arg);
	return {
		start: cursor.from,
		site: {
			kind: "dynamic",
			typeOnly,
			execution,
			specifier: literal?.specifier ?? null,
			range: position,
			python: dynamicPythonFacts(literal),
		},
	};
}

function dynamicPosition(
	text: string,
	cursor: TreeCursor,
	literal: ReturnType<typeof pythonDynamicLiteral>,
	arg: Leaf | undefined,
): Range {
	const from = literal?.from ?? arg?.from ?? cursor.from;
	const to = literal?.to ?? arg?.to ?? cursor.to;
	return rangeAt(text, from, to);
}

function dynamicPythonFacts(
	literal: ReturnType<typeof pythonDynamicLiteral>,
): NonNullable<ImportSite["python"]> {
	return {
		form: "dynamic",
		module: literal?.module ?? null,
		level: literal?.level ?? 0,
		imported: [],
		packageName: literal?.packageName ?? null,
	};
}

function appendDynamicSite(
	sites: LocatedSite[],
	text: string,
	cursor: TreeCursor,
	bindings: ReturnType<typeof scanPythonBindings>,
): void {
	if (cursor.name !== "CallExpression") return;
	const dynamic = bindings.dynamicCalls.get(cursor.from);
	if (dynamic === undefined) return;
	const context = bindings.contexts.get(cursor.from);
	sites.push(
		callDynamicSite(text, cursor, context?.typeOnly ?? false, dynamic, {
			deferred: context?.deferred ?? false,
			conditional: context?.conditional ?? false,
		}),
	);
}

function importStatementSites(text: string, cursor: TreeCursor, typeOnly: boolean): LocatedSite[] {
	const parts = leaves(cursor);
	const from = parts[0]?.name === "from";
	return from ? fromImportSites(text, cursor, typeOnly) : plainImportSites(text, cursor, typeOnly);
}

/**
 * Extract Python imports from the caller-owned shared parse. This never reparses text;
 * text only supplies exact module spelling and source positions represented by the tree.
 */
export function collectPythonImportSites(tree: Tree, text: string, _path: string): ImportSite[] {
	const sites: LocatedSite[] = [];
	const bindings = scanPythonBindings(tree, text);
	const cursor = tree.cursor();
	const visit = (): void => {
		if (cursor.name === "ImportStatement") {
			const context = bindings.contexts.get(cursor.from);
			for (const located of importStatementSites(text, cursor, context?.typeOnly ?? false))
				sites.push({
					...located,
					site: {
						...located.site,
						execution: {
							deferred: context?.deferred ?? false,
							conditional: context?.conditional ?? false,
						},
					},
				});
			return;
		}
		appendDynamicSite(sites, text, cursor, bindings);
		if (cursor.firstChild()) {
			do visit();
			while (cursor.nextSibling());
			cursor.parent();
		}
	};
	visit();
	return sites.sort((a, b) => a.start - b.start).map((located) => located.site);
}
