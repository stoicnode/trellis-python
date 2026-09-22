/** Stricter postfilters for normalized clone groups; research evidence, never scoring. */
import ts from "typescript";
import { nodeFromCursor } from "../python/tree.ts";
import type { FileSyntax } from "../syntax/index.ts";
import type { TokenStream } from "./duplication.ts";
import type { CloneTokenInterval } from "./duplication-finalize.ts";
import type { DuplicationWork } from "./duplication-work.ts";

export interface CloneSemanticEvidence {
	kindPreserving: boolean | null;
	equalityPreserving: boolean | null;
	exactContentCopy: boolean | null;
	statementAligned: boolean | null;
}

interface Boundaries {
	starts: Set<number>;
	ends: Set<number>;
}

function pythonStatementBoundaries(
	file: Extract<FileSyntax, { language: "python" }>,
	work: DuplicationWork,
): Boundaries {
	const starts = new Set<number>();
	const ends = new Set<number>();
	const stack = [nodeFromCursor(file.parserTree.cursor())];
	while (stack.length > 0) {
		work.charge();
		const node = stack.pop();
		if (node === undefined) continue;
		if (
			node.name.endsWith("Statement") ||
			node.name === "FunctionDefinition" ||
			node.name === "ClassDefinition"
		) {
			starts.add(node.from);
			ends.add(node.to);
		}
		for (const child of node.children) stack.push(child);
	}
	return { starts, ends };
}

function typeScriptStatementBoundaries(
	file: Extract<FileSyntax, { sourceFile: ts.SourceFile }>,
	work: DuplicationWork,
): Boundaries {
	const starts = new Set<number>();
	const ends = new Set<number>();
	const stack: ts.Node[] = [file.sourceFile];
	while (stack.length > 0) {
		work.charge();
		const node = stack.pop();
		if (node === undefined) continue;
		if (ts.isStatement(node)) {
			starts.add(node.getStart(file.sourceFile));
			ends.add(node.getEnd());
		}
		for (const child of node.getChildren(file.sourceFile)) stack.push(child);
	}
	return { starts, ends };
}

function statementBoundaries(file: FileSyntax, work: DuplicationWork): Boundaries {
	return file.language === "python"
		? pythonStatementBoundaries(file, work)
		: typeScriptStatementBoundaries(file, work);
}

function isPlaceholder(kind: number): boolean {
	return (
		kind === ts.SyntaxKind.Identifier ||
		kind === ts.SyntaxKind.StringLiteral ||
		kind === 0x40000001 ||
		kind === 0x40000002
	);
}

interface TokenSignature {
	rawKinds: number[];
	equalityPattern: number[];
	lexemes: string[];
}

function signature(
	file: FileSyntax,
	stream: TokenStream,
	interval: CloneTokenInterval,
	work: DuplicationWork,
): TokenSignature | null {
	if (
		stream.rawKinds === undefined ||
		stream.startOffsets === undefined ||
		stream.endOffsets === undefined
	)
		return null;
	const text = file.language === "python" ? (file.text ?? "") : file.sourceFile.text;
	const classes = new Map<string, number>();
	const rawKinds: number[] = [];
	const equalityPattern: number[] = [];
	const lexemes: string[] = [];
	for (let index = interval.startToken; index < interval.endToken; index += 1) {
		work.charge();
		const rawKind = stream.rawKinds[index];
		if (rawKind === undefined) return null;
		const lexeme = text.slice(stream.startOffsets[index] ?? 0, stream.endOffsets[index] ?? 0);
		rawKinds.push(rawKind);
		lexemes.push(lexeme);
		if (!isPlaceholder(stream.kinds[index] ?? -1)) {
			equalityPattern.push(-1);
			continue;
		}
		const key = `${rawKind}\0${lexeme}`;
		let classId = classes.get(key);
		if (classId === undefined) {
			classId = classes.size;
			classes.set(key, classId);
		}
		equalityPattern.push(classId);
	}
	return { rawKinds, equalityPattern, lexemes };
}

function equalArray<T>(left: readonly T[], right: readonly T[]): boolean {
	return left.length === right.length && left.every((item, index) => item === right[index]);
}

function aligned(
	stream: TokenStream,
	interval: CloneTokenInterval,
	boundaries: Boundaries,
): boolean | null {
	if (stream.startOffsets === undefined || stream.endOffsets === undefined) return null;
	const start = stream.startOffsets[interval.startToken];
	const end = stream.endOffsets[interval.endToken - 1];
	if (start === undefined || end === undefined) return null;
	return boundaries.starts.has(start) && boundaries.ends.has(end);
}

/** Compare stricter normalized variants on the same raw candidate group. */
export function assessCloneSemantics(
	intervals: readonly CloneTokenInterval[],
	files: ReadonlyMap<string, FileSyntax>,
	streams: ReadonlyMap<string, TokenStream>,
	boundaries: Map<string, Boundaries>,
	work: DuplicationWork,
): CloneSemanticEvidence {
	const signatures: TokenSignature[] = [];
	const alignments: boolean[] = [];
	for (const interval of intervals) {
		work.charge();
		const file = files.get(interval.path);
		const stream = streams.get(interval.path);
		if (file === undefined || stream === undefined)
			return {
				kindPreserving: null,
				equalityPreserving: null,
				exactContentCopy: null,
				statementAligned: null,
			};
		const value = signature(file, stream, interval, work);
		if (value === null)
			return {
				kindPreserving: null,
				equalityPreserving: null,
				exactContentCopy: null,
				statementAligned: null,
			};
		signatures.push(value);
		let boundary = boundaries.get(interval.path);
		if (boundary === undefined) {
			boundary = statementBoundaries(file, work);
			boundaries.set(interval.path, boundary);
		}
		const isAligned = aligned(stream, interval, boundary);
		if (isAligned === null)
			return {
				kindPreserving: null,
				equalityPreserving: null,
				exactContentCopy: null,
				statementAligned: null,
			};
		alignments.push(isAligned);
	}
	const first = signatures[0];
	if (first === undefined || intervals.length < 2)
		return {
			kindPreserving: null,
			equalityPreserving: null,
			exactContentCopy: null,
			statementAligned: null,
		};
	return {
		kindPreserving: signatures.every((entry) => equalArray(first.rawKinds, entry.rawKinds)),
		equalityPreserving: signatures.every((entry) =>
			equalArray(first.equalityPattern, entry.equalityPattern),
		),
		exactContentCopy: signatures.every((entry) => equalArray(first.lexemes, entry.lexemes)),
		statementAligned: alignments.every(Boolean),
	};
}
