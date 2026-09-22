#!/usr/bin/env bun
/** Build the blinded-study function census from operator-prepared pinned sources. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import { discoverSourceInventory } from "../src/discovery/index.ts";
import { analyzeComplexity } from "../src/metrics/analyze.ts";
import { analyzeDuplication } from "../src/metrics/analyze-duplication.ts";
import type { FunctionMeasurement } from "../src/metrics/types.ts";
import type { StudyUnit } from "../src/research/study-sampling.ts";
import { buildSyntaxInventory } from "../src/syntax/index.ts";

const repositorySchema = z.strictObject({
	id: z.string().min(1),
	language: z.enum(["python", "typescript"]),
	role: z.enum(["library", "framework", "developer-tool"]),
	remote: z.string().url(),
	commit: z.string().regex(/^[0-9a-f]{40}$/),
	scope: z.string().min(1),
});
const preregistrationSchema = z
	.strictObject({
		sizeBucketsExecutableSloc: z.strictObject({
			smallMax: z.number().int().positive(),
			mediumMax: z.number().int().positive(),
		}),
		repositories: z.array(repositorySchema).length(6),
	})
	.passthrough();
type Repository = z.infer<typeof repositorySchema>;

interface CloneMemberFlag {
	path: string;
	startLine: number;
	endLine: number;
	kind: string;
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

function verify(root: string, repository: Repository): void {
	if (git(root, ["rev-parse", "HEAD"]) !== repository.commit)
		throw new Error(`${repository.id}: checkout does not match the registered commit`);
	if (git(root, ["status", "--porcelain", "--untracked-files=all"]) !== "")
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

function cloneFlags(
	findings: ReturnType<typeof analyzeDuplication>["findings"],
): CloneMemberFlag[] {
	return findings.flatMap((finding) => {
		const facts = finding.facts;
		const members = Array.isArray(facts?.members) ? facts.members : [];
		const executable = new Set(
			Array.isArray(facts?.independentExecutableMemberIndexes)
				? facts.independentExecutableMemberIndexes.filter(
						(index): index is number => typeof index === "number",
					)
				: [],
		);
		return members.flatMap((member, index) => {
			if (typeof member !== "object" || member === null) return [];
			const value = member as Record<string, unknown>;
			if (
				typeof value.path !== "string" ||
				typeof value.startLine !== "number" ||
				typeof value.endLine !== "number"
			)
				return [];
			return [
				{
					path: value.path,
					startLine: value.startLine,
					endLine: value.endLine,
					kind: executable.has(index)
						? "duplication.candidate.independent-executable"
						: "duplication.clone-group",
				},
			];
		});
	});
}

function overlaps(fn: FunctionMeasurement, member: CloneMemberFlag): boolean {
	return (
		fn.path === member.path &&
		member.startLine <= fn.range.end.line &&
		member.endLine >= fn.range.start.line
	);
}

function stableId(repository: string, fn: FunctionMeasurement): string {
	const identity =
		fn.identity.state === "identified"
			? JSON.stringify(fn.identity)
			: `line:${fn.range.start.line}`;
	return `${repository}:${fn.path}:${fn.kind}:${identity}`;
}

function sizeBucket(
	sloc: number,
	limits: { smallMax: number; mediumMax: number },
): StudyUnit["sizeBucket"] {
	if (sloc <= limits.smallMax) return "small";
	if (sloc <= limits.mediumMax) return "medium";
	return "large";
}

function excerpt(root: string, fn: FunctionMeasurement) {
	const lines = readFileSync(resolve(root, fn.path), "utf8").split(/\r?\n/);
	const start = Math.max(1, fn.range.start.line - 2);
	const end = Math.min(lines.length, fn.range.end.line + 2);
	return {
		excerptStartLine: start,
		excerptEndLine: end,
		excerpt: lines.slice(start - 1, end).join("\n"),
		excerptTruncated: false,
	};
}

function unit(
	root: string,
	repository: Repository,
	fn: FunctionMeasurement,
	flags: readonly CloneMemberFlag[],
	limits: { smallMax: number; mediumMax: number },
): StudyUnit {
	const flagKinds = [
		...(fn.eroded ? ["complexity.hotspot"] : []),
		...(fn.maxNesting >= 3 ? ["executable.nesting"] : []),
		...flags.filter((flag) => overlaps(fn, flag)).map((flag) => flag.kind),
	];
	return {
		id: stableId(repository.id, fn),
		repository: repository.id,
		language: repository.language,
		role: repository.role,
		path: fn.path,
		kind: fn.kind,
		sizeBucket: sizeBucket(fn.sloc, limits),
		startLine: fn.range.start.line,
		endLine: fn.range.end.line,
		...excerpt(root, fn),
		flagKinds: [...new Set(flagKinds)].sort(),
	};
}

function licenses(checkout: string) {
	return readdirSync(checkout, { withFileTypes: true })
		.filter((entry) => entry.isFile() && /^(?:licen[cs]e|copying)/i.test(entry.name))
		.map((entry) => {
			const bytes = readFileSync(resolve(checkout, entry.name));
			return { path: entry.name, sha256: createHash("sha256").update(bytes).digest("hex") };
		})
		.sort((a, b) => a.path.localeCompare(b.path));
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const preregistration = preregistrationSchema.parse(
		JSON.parse(readFileSync(argument(args, "--preregistration"), "utf8")),
	);
	const preparedRoot = argument(args, "--prepared-root");
	const units: StudyUnit[] = [];
	const sources = [];
	for (const repository of preregistration.repositories) {
		const checkout = resolve(preparedRoot, repository.id);
		verify(checkout, repository);
		const root = scopeRoot(preparedRoot, repository);
		const source = await discoverSourceInventory(root);
		const syntax = await buildSyntaxInventory(source);
		const complexity = analyzeComplexity(syntax);
		const clones = cloneFlags(analyzeDuplication(syntax).findings);
		const measured = complexity.functions
			.filter((fn) => fn.sourceSet === "production")
			.map((fn) => unit(root, repository, fn, clones, preregistration.sizeBucketsExecutableSloc));
		units.push(...measured);
		sources.push({
			repository: repository.id,
			remote: repository.remote,
			commit: repository.commit,
			scope: repository.scope,
			productionUnits: measured.length,
			flaggedUnits: measured.filter((entry) => entry.flagKinds.length > 0).length,
			licenses: licenses(checkout),
		});
		verify(checkout, repository);
	}
	units.sort((a, b) => a.id.localeCompare(b.id));
	writeFileSync(argument(args, "--out"), `${JSON.stringify(units, null, 2)}\n`);
	writeFileSync(
		argument(args, "--source-record"),
		`${JSON.stringify({ version: 1, sources }, null, 2)}\n`,
	);
}

if (import.meta.main)
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
