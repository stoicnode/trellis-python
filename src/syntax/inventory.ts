/**
 * The shared syntax and function inventory for one audit (SPEC §4 `syntax/`).
 *
 * {@link buildSyntaxInventory} consumes a discovery `SourceInventory`
 * (trellis-6003), reads and parses every classified TS/TSX file **once**, and
 * bundles the parses, function inventories, line counts, and located parse
 * diagnostics into one immutable-by-convention {@link SyntaxInventory}. Every
 * metric analyzer in the audit consumes this object — no analyzer re-reads
 * or re-parses a file, which is what makes parsing "reused across metrics
 * within one audit" (SPEC §13).
 *
 * Failure handling (SPEC §3.3): a file that fails to read or parses with
 * diagnostics still contributes a {@link FileSyntax} (read failures parse as
 * empty text); the problem is surfaced as a located {@link ParseDiagnostic}
 * and the inventory's `completeness` rolls up to `"incomplete"`. The parse
 * layer never throws on source content.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import type { Range } from "../contract/index.ts";
import type { ClassifiedFile, SourceInventory } from "../discovery/index.ts";
import { pythonDocstrings } from "../python/docstrings.ts";
import { pythonFunctionInventory } from "../python/function-inventory.ts";
import { collectPythonImportSites } from "../python/imports.ts";
import { PYTHON_PARSER_VERSION, parsePython, pythonLineKinds } from "../python/parser.ts";
import { collectFunctions } from "./functions.ts";
import { collectImportSites } from "./import-sites.ts";
import { parseSource } from "./parse.ts";
import { classifyLines, countLines } from "./sloc.ts";
import type { FileSyntax, ParseDiagnostic, SyntaxInventory } from "./types.ts";

/** A point range at line 1, column 1 — the location for file-wide problems (read failures). */
const FILE_START_RANGE: Range = {
	start: { line: 1, column: 1 },
	end: { line: 1, column: 1 },
};

/** Parse one classified file into a {@link FileSyntax}; read failures become `read-error` diagnostics. */
async function parseTypeScriptFile(file: ClassifiedFile, text: string): Promise<FileSyntax> {
	const parsed = parseSource(file.path, text);
	const { functions, signatureCount } = collectFunctions(parsed.sourceFile);
	return {
		path: file.path,
		packagePath: file.packagePath,
		sourceSet: file.sourceSet,
		language: "typescript",
		text,
		scriptKind: parsed.scriptKind,
		sourceFile: parsed.sourceFile,
		functions,
		lines: countLines(parsed.sourceFile),
		lineKinds: classifyLines(parsed.sourceFile),
		imports: collectImportSites(parsed.sourceFile),
		signatureCount,
		diagnostics: [...parsed.diagnostics],
	};
}

async function parsePythonFile(file: ClassifiedFile, text: string): Promise<FileSyntax> {
	const parsed = parsePython(file.path, text);
	const lineFacts = pythonLineKinds(parsed.tree, text);
	const docstrings = pythonDocstrings(parsed.tree, text);
	const executable = pythonLineKinds(parsed.tree, text, docstrings);
	const functions = pythonFunctionInventory(parsed.tree, text, file.sourceSet, executable.kinds);
	return {
		path: file.path,
		packagePath: file.packagePath,
		sourceSet: file.sourceSet,
		language: "python",
		text,
		parserTree: parsed.tree,
		docstrings,
		executableLines: executable.lines,
		executableLineKinds: executable.kinds,
		functions: functions.functions,
		orphanOverloads: functions.orphanOverloads,
		lines: lineFacts.lines,
		lineKinds: lineFacts.kinds,
		imports: collectPythonImportSites(parsed.tree, text, file.path),
		signatureCount: functions.signatureCount,
		diagnostics: [...parsed.diagnostics],
	};
}

async function parseClassifiedFile(root: string, file: ClassifiedFile): Promise<FileSyntax> {
	const bytes = await readFile(join(root, file.path)).catch(() => null);
	if (bytes === null) {
		const diagnostics: ParseDiagnostic[] = [
			{
				path: file.path,
				range: FILE_START_RANGE,
				code: "read-error",
				message: `could not read ${file.path}; analyzed as empty`,
			},
		];
		if (file.language === "python") {
			const parsed = await parsePythonFile(file, "");
			return { ...parsed, diagnostics: [...diagnostics, ...parsed.diagnostics] };
		}
		const parsed = await parseTypeScriptFile(file, "");
		return { ...parsed, diagnostics: [...diagnostics, ...parsed.diagnostics] };
	}
	let text: string;
	if (file.language === "python") {
		try {
			text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		} catch {
			const parsed = await parsePythonFile(file, "");
			return {
				...parsed,
				diagnostics: [
					{
						path: file.path,
						range: FILE_START_RANGE,
						code: "PY-ENCODING",
						message: "Python source is not valid UTF-8",
					},
				],
			};
		}
	} else text = bytes.toString("utf8");
	return file.language === "python" ? parsePythonFile(file, text) : parseTypeScriptFile(file, text);
}

/** Order diagnostics by path, then start line, then start column. */
function byLocation(a: ParseDiagnostic, b: ParseDiagnostic): number {
	if (a.path !== b.path) return a.path < b.path ? -1 : 1;
	if (a.range.start.line !== b.range.start.line) return a.range.start.line - b.range.start.line;
	return (a.range.start.column ?? 1) - (b.range.start.column ?? 1);
}

/**
 * Build the shared syntax inventory for one audit. File order follows the
 * discovery inventory (already sorted), so the result is stable across
 * filesystem enumeration order; per-file parsing is concurrent but the
 * output positions are fixed by index, never by completion order.
 */
export async function buildSyntaxInventory(source: SourceInventory): Promise<SyntaxInventory> {
	const files = await Promise.all(
		source.files.map((file) => parseClassifiedFile(source.root, file)),
	);
	const diagnostics = files.flatMap((file) => file.diagnostics).sort(byLocation);
	return {
		root: source.root,
		compilerVersion: `${ts.version}-python.${PYTHON_PARSER_VERSION}`,
		files,
		functionCount: files.reduce((sum, file) => sum + file.functions.length, 0),
		diagnostics,
		completeness: diagnostics.length === 0 ? "complete" : "incomplete",
	};
}
