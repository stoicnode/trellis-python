#!/usr/bin/env bun
/** Build complete-unit and relationship context for the archived 120-sample packet. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import { discoverSourceInventory } from "../src/discovery/index.ts";
import { analyzeDuplication } from "../src/metrics/analyze-duplication.ts";
import { analyzeDependencyGraph } from "../src/metrics/analyze-graph.ts";
import type { CloneGroup } from "../src/metrics/duplication.ts";
import type { GraphEdge } from "../src/metrics/graph-types.ts";
import { buildSyntaxInventory, type FileSyntax } from "../src/syntax/index.ts";

const repositorySchema = z.strictObject({
	id: z.string().min(1),
	language: z.enum(["python", "typescript"]),
	role: z.enum(["library", "framework", "developer-tool"]),
	remote: z.string().url(),
	commit: z.string().regex(/^[0-9a-f]{40}$/),
	scope: z.string().min(1),
});
const preregistrationSchema = z
	.strictObject({ repositories: z.array(repositorySchema).length(6) })
	.passthrough();
const keySchema = z.array(
	z.strictObject({
		blindId: z.string().min(1),
		unitId: z.string().min(1),
		stratum: z.enum(["flagged", "matched-unflagged"]),
		flagKinds: z.array(z.string()),
	}),
);
const unitSchema = z
	.object({
		id: z.string(),
		repository: z.string(),
		language: z.enum(["python", "typescript"]),
		role: z.enum(["library", "framework", "developer-tool"]),
		path: z.string(),
		kind: z.string(),
		sizeBucket: z.enum(["small", "medium", "large"]),
		startLine: z.number().int().positive(),
		endLine: z.number().int().positive(),
	})
	.passthrough();
type Repository = z.infer<typeof repositorySchema>;
type SelectedUnit = z.infer<typeof unitSchema>;

interface ContextStats {
	targetLines: number;
	neighborLines: number;
	lexicalReferencesIncluded: number;
	lexicalReferencesTotal: number;
	cloneGroupsIncluded: number;
	cloneMembersIncluded: number;
	cloneRepresentativeSourcesIncluded: number;
	outgoingEdges: number;
	incomingEdges: number;
}

function argument(args: string[], name: string): string {
	const index = args.indexOf(name);
	const value = index < 0 ? undefined : args[index + 1];
	if (value === undefined) throw new Error(`missing ${name}`);
	return resolve(value);
}

function git(root: string, args: string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function verify(checkout: string, repository: Repository): void {
	if (git(checkout, ["rev-parse", "HEAD"]) !== repository.commit)
		throw new Error(`${repository.id}: checkout does not match the registered commit`);
	if (git(checkout, ["status", "--porcelain", "--untracked-files=all"]) !== "")
		throw new Error(`${repository.id}: checkout is dirty`);
}

function scopeRoot(preparedRoot: string, repository: Repository): string {
	const checkout = resolve(preparedRoot, repository.id);
	const scope = resolve(checkout, repository.scope);
	const local = relative(checkout, scope);
	if (local.startsWith("..") || isAbsolute(local))
		throw new Error(`${repository.id}: scope escapes checkout`);
	return scope;
}

function sourceLines(root: string, path: string): string[] {
	return readFileSync(resolve(root, path), "utf8").split(/\r?\n/);
}

function numbered(lines: readonly string[], startLine: number, endLine: number): string {
	const width = String(endLine).length;
	return lines
		.slice(startLine - 1, endLine)
		.map((line, index) => `${String(startLine + index).padStart(width, " ")} | ${line}`)
		.join("\n");
}

function overlaps(
	left: { startLine: number; endLine: number },
	right: { startLine: number; endLine: number },
): boolean {
	return left.startLine <= right.endLine && right.startLine <= left.endLine;
}

function matchingCloneGroups(unit: SelectedUnit, groups: readonly CloneGroup[]): CloneGroup[] {
	return groups.filter((group) =>
		group.members.some(
			(member) =>
				member.path === unit.path &&
				overlaps(unit, {
					startLine: member.range.start.line,
					endLine: member.range.end.line,
				}),
		),
	);
}

function cloneContext(root: string, groups: readonly CloneGroup[]): string {
	if (groups.length === 0) return "No measured clone group overlaps this unit.";
	return groups
		.map((group) => {
			const members = group.members.map((member, index) => {
				const start = member.range.start.line;
				const end = member.range.end.line;
				return `Member ${index + 1}/${group.members.length}: ${member.path}:${start}-${end}`;
			});
			const representative = group.members[0];
			if (representative === undefined) return "";
			const start = representative.range.start.line;
			const end = representative.range.end.line;
			const lines = sourceLines(root, representative.path);
			return [
				`Clone relationship ${group.id}, ${group.members.length} members (every location follows):`,
				...members,
				`Representative normalized-match source ${representative.path}:${start}-${end}:`,
				numbered(lines, start, end),
			].join("\n");
		})
		.filter(Boolean)
		.join("\n\n");
}

function functionName(file: FileSyntax, unit: SelectedUnit): string | null {
	const found = file.functions.find(
		(fn) => fn.range.start.line === unit.startLine && fn.range.end.line === unit.endLine,
	);
	return found === undefined || found.name === "(anonymous)" ? null : found.name;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lexicalReferences(
	files: readonly FileSyntax[],
	unit: SelectedUnit,
	name: string | null,
): { text: string; included: number; total: number } {
	if (name === null || !/^[$A-Z_a-z][$\w]*$/.test(name)) {
		return {
			text: "No stable identifier was available for lexical caller lookup.",
			included: 0,
			total: 0,
		};
	}
	const matcher = new RegExp(`\\b${escapeRegExp(name)}\\b`);
	const references: Array<{ path: string; line: number; text: string }> = [];
	for (const file of files) {
		const lines = (file.text ?? "").split(/\r?\n/);
		for (const [index, line] of lines.entries()) {
			if (!matcher.test(line)) continue;
			const number = index + 1;
			if (file.path === unit.path && number >= unit.startLine && number <= unit.endLine) continue;
			references.push({ path: file.path, line: number, text: line.trim() });
		}
	}
	const selected = references.slice(0, 8);
	return {
		text:
			selected.length === 0
				? `No other lexical references to ${JSON.stringify(name)} were found.`
				: selected.map((entry) => `${entry.path}:${entry.line} | ${entry.text}`).join("\n"),
		included: selected.length,
		total: references.length,
	};
}

function edgeText(edge: GraphEdge): string {
	const resolution =
		edge.resolution.status === "local" || edge.resolution.status === "out-of-scope"
			? `${edge.resolution.status}:${edge.resolution.target}`
			: edge.resolution.status === "external"
				? `external:${edge.resolution.packageName}`
				: `unresolved:${edge.resolution.reason}`;
	return `${edge.from}:${edge.range.start.line} ${edge.kind} ${JSON.stringify(edge.specifier)} -> ${resolution}${edge.typeOnly ? " [type-only]" : ""}`;
}

function graphContext(path: string, edges: readonly GraphEdge[]) {
	const outgoing = edges.filter((edge) => edge.from === path);
	const incoming = edges.filter(
		(edge) => edge.resolution.status === "local" && edge.resolution.target === path,
	);
	return {
		text: [
			"Outgoing import edges:",
			...(outgoing.length === 0 ? ["(none)"] : outgoing.map(edgeText)),
			"",
			"Incoming local import edges:",
			...(incoming.length === 0 ? ["(none)"] : incoming.map(edgeText)),
		].join("\n"),
		outgoing: outgoing.length,
		incoming: incoming.length,
	};
}

function buildContext(
	root: string,
	unit: SelectedUnit,
	file: FileSyntax,
	files: readonly FileSyntax[],
	groups: readonly CloneGroup[],
	edges: readonly GraphEdge[],
): { source: string; stats: ContextStats } {
	const lines = sourceLines(root, unit.path);
	const beforeStart = Math.max(1, unit.startLine - 12);
	const afterEnd = Math.min(lines.length, unit.endLine + 12);
	const before =
		unit.startLine > beforeStart ? numbered(lines, beforeStart, unit.startLine - 1) : "(none)";
	const after = unit.endLine < afterEnd ? numbered(lines, unit.endLine + 1, afterEnd) : "(none)";
	const clones = matchingCloneGroups(unit, groups);
	const references = lexicalReferences(files, unit, functionName(file, unit));
	const graph = graphContext(unit.path, edges);
	const sections = [
		`TARGET COMPLETE UNIT: ${unit.path}:${unit.startLine}-${unit.endLine}`,
		numbered(lines, unit.startLine, unit.endLine),
		"NEIGHBORING SOURCE BEFORE TARGET:",
		before,
		"NEIGHBORING SOURCE AFTER TARGET:",
		after,
		"LEXICAL REFERENCES (possible callers or usages; deterministic first eight):",
		references.text,
		"CLONE RELATIONSHIP CONTEXT (every member of every overlapping group):",
		cloneContext(root, clones),
		"FILE IMPORT AND DEPENDENCY CONTEXT:",
		graph.text,
	];
	return {
		source: sections.join("\n\n"),
		stats: {
			targetLines: unit.endLine - unit.startLine + 1,
			neighborLines: unit.startLine - beforeStart + (afterEnd - unit.endLine),
			lexicalReferencesIncluded: references.included,
			lexicalReferencesTotal: references.total,
			cloneGroupsIncluded: clones.length,
			cloneMembersIncluded: clones.reduce((sum, group) => sum + group.members.length, 0),
			cloneRepresentativeSourcesIncluded: clones.length,
			outgoingEdges: graph.outgoing,
			incomingEdges: graph.incoming,
		},
	};
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const preregistration = preregistrationSchema.parse(
		JSON.parse(readFileSync(argument(args, "--preregistration"), "utf8")),
	);
	const units = z
		.array(unitSchema)
		.parse(JSON.parse(readFileSync(argument(args, "--units"), "utf8")));
	const unitsById = new Map(units.map((unit) => [unit.id, unit]));
	const key = keySchema.parse(JSON.parse(readFileSync(argument(args, "--answer-key"), "utf8")));
	const preparedRoot = argument(args, "--prepared-root");
	const packet = [];
	for (const repository of preregistration.repositories) {
		const checkout = resolve(preparedRoot, repository.id);
		verify(checkout, repository);
		const root = scopeRoot(preparedRoot, repository);
		const source = await discoverSourceInventory(root);
		const syntax = await buildSyntaxInventory(source);
		const duplication = analyzeDuplication(syntax).scopes.production;
		const graph = analyzeDependencyGraph(source, syntax).graph;
		const files = new Map(syntax.files.map((file) => [file.path, file]));
		for (const selected of key.filter((entry) => entry.unitId.startsWith(`${repository.id}:`))) {
			const unit = unitsById.get(selected.unitId);
			if (unit === undefined) throw new Error(`missing census unit ${selected.unitId}`);
			const file = files.get(unit.path);
			if (file === undefined) throw new Error(`missing syntax file ${repository.id}:${unit.path}`);
			const context = buildContext(root, unit, file, syntax.files, duplication.groups, graph.edges);
			packet.push({
				blindId: selected.blindId,
				repository: unit.repository,
				language: unit.language,
				role: unit.role,
				path: unit.path,
				kind: unit.kind,
				sizeBucket: unit.sizeBucket,
				startLine: unit.startLine,
				endLine: unit.endLine,
				contextSource: context.source,
				contextStats: context.stats,
			});
		}
		verify(checkout, repository);
	}
	packet.sort((left, right) => left.blindId.localeCompare(right.blindId));
	const serialized = `${JSON.stringify(packet, null, 2)}\n`;
	writeFileSync(argument(args, "--out"), serialized);
	process.stdout.write(
		`${JSON.stringify({ records: packet.length, bytes: Buffer.byteLength(serialized), sha256: createHash("sha256").update(serialized).digest("hex") }, null, 2)}\n`,
	);
}

if (import.meta.main) {
	main().catch((error) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
