#!/usr/bin/env bun
/** Explicit preparation-only comparison; never imported by the audit or tests. */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

function pythonFiles(root: string, current = root): string[] {
	return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(current, entry.name);
		return entry.isDirectory() ? pythonFiles(root, path) : entry.name.endsWith(".py") ? [path] : [];
	});
}

const root = process.argv[2];
if (root === undefined)
	throw new Error("usage: prepare-python-ast-parse.ts <prepared-python-repo>");
const revision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
	encoding: "utf8",
}).trim();
const files = pythonFiles(root);
const failures = files.flatMap((path) => {
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
console.log(
	JSON.stringify({ root, revision, files: files.length, astParseFailures: failures }, null, 2),
);
