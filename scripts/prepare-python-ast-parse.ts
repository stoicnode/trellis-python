#!/usr/bin/env bun
/**
 * Explicit preparation-only ast.parse comparison. This script is never
 * imported by the audit path; `python3` is intentionally ignored by Knip.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { loadOssBenchmarkManifest, type OssBenchmarkManifest } from "./validate-oss-benchmarks.ts";

const evidenceEntrySchema = z.strictObject({
	id: z.string().min(1),
	revision: z.string().regex(/^[0-9a-f]{40}$/),
	tree: z.string().regex(/^[0-9a-f]{40}$/),
	files: z.number().int().nonnegative(),
	astParseFailures: z.array(z.string()),
});
const evidenceSchema = z.strictObject({
	purpose: z.string().min(1),
	interpreter: z.literal("python3"),
	interpreterVersion: z.string().min(1),
	entries: z.array(evidenceEntrySchema).min(1),
});

export type PythonAstEvidence = z.infer<typeof evidenceSchema>;
export type PythonAstRun = PythonAstEvidence;

export function parsePythonAstEvidence(value: unknown): PythonAstEvidence {
	return evidenceSchema.parse(value);
}

export function loadCommittedPythonAstEvidence(root: string): PythonAstEvidence {
	return parsePythonAstEvidence(
		JSON.parse(readFileSync(resolve(root, "python-ast-parse.json"), "utf8")),
	);
}

/** Verify that evidence names only the manifest's pinned Python repositories. */
export function pythonAstEvidenceMismatches(
	manifest: OssBenchmarkManifest,
	evidence: PythonAstEvidence,
): string[] {
	const repositories = new Map(manifest.repositories.map((entry) => [entry.id, entry]));
	const required = ["flask", "requests", "rich"];
	const ids = new Set<string>();
	const failures: string[] = [];
	for (const entry of evidence.entries) {
		const repository = repositories.get(entry.id);
		if (repository === undefined) failures.push(`${entry.id}: missing from benchmark manifest`);
		else if (entry.revision !== repository.commit || entry.tree !== repository.tree)
			failures.push(`${entry.id}: evidence revision/tree differs from manifest pin`);
		if (ids.has(entry.id)) failures.push(`${entry.id}: duplicate evidence entry`);
		ids.add(entry.id);
	}
	if (JSON.stringify([...ids].sort()) !== JSON.stringify(required))
		failures.push("evidence must contain exactly flask, requests, and rich");
	return failures;
}

/* c8 ignore start -- preparation invokes external Git and Python by contract. */
function pythonFiles(root: string, current = root): string[] {
	return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(current, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`prepared checkout rejects symlink: ${path}`);
		return entry.isDirectory() ? pythonFiles(root, path) : entry.name.endsWith(".py") ? [path] : [];
	});
}

function git(root: string, args: string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function astParseFailures(files: readonly string[]): string[] {
	return files.flatMap((path) => {
		try {
			execFileSync("python3", [
				"-c",
				"import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())",
				path,
			]);
			return [];
		} catch {
			return [path];
		}
	});
}

/** Compare a prepared checkout against the committed evidence and manifest pin. */
export function preparePythonAstEvidence(
	preparedRoot: string,
	manifest: OssBenchmarkManifest,
	evidence: PythonAstEvidence,
): PythonAstRun {
	const mismatches = pythonAstEvidenceMismatches(manifest, evidence);
	if (mismatches.length > 0) throw new Error(mismatches.join("; "));
	const interpreterVersion = execFileSync("python3", ["--version"], { encoding: "utf8" }).trim();
	if (interpreterVersion !== evidence.interpreterVersion)
		throw new Error("python3 version differs from committed ast.parse evidence");
	const entries = evidence.entries.map((expected) => {
		const root = resolve(preparedRoot, expected.id);
		const revision = git(root, ["rev-parse", "HEAD"]);
		const tree = git(root, ["rev-parse", "HEAD^{tree}"]);
		if (revision !== expected.revision || tree !== expected.tree) {
			throw new Error(`${expected.id}: checkout does not match committed revision/tree evidence`);
		}
		const files = pythonFiles(root);
		const actual = {
			...expected,
			revision,
			tree,
			files: files.length,
			astParseFailures: astParseFailures(files),
		};
		if (
			actual.files !== expected.files ||
			JSON.stringify(actual.astParseFailures) !== JSON.stringify(expected.astParseFailures)
		) {
			throw new Error(`${expected.id}: ast.parse output differs from committed evidence`);
		}
		return actual;
	});
	return { ...evidence, interpreterVersion, entries };
}

if (import.meta.main) {
	const preparedRoot = process.argv[2];
	if (preparedRoot === undefined)
		throw new Error("usage: prepare-python-ast-parse.ts <prepared-python-repositories>");
	const benchmarkRoot = resolve(import.meta.dir, "../corpus/oss-benchmark");
	console.log(
		JSON.stringify(
			preparePythonAstEvidence(
				preparedRoot,
				loadOssBenchmarkManifest(benchmarkRoot),
				loadCommittedPythonAstEvidence(benchmarkRoot),
			),
			null,
			2,
		),
	);
}
/* c8 ignore stop */
