/** Advisory clone population over AST roles and exact, non-overlapping token intervals. */
import { classifyLines, type FileSyntax } from "../syntax/index.ts";
import type { CloneTokenContext } from "../syntax/types.ts";
import { assessCloneSemantics, type CloneSemanticEvidence } from "./clone-semantics.ts";
import type { CloneGroup, TokenStream } from "./duplication.ts";
import type { CloneTokenInterval } from "./duplication-finalize.ts";
import type { DuplicationWork } from "./duplication-work.ts";

export interface CloneCandidateGroup extends CloneSemanticEvidence {
	id: string;
	context: CloneTokenContext;
	independentOccurrences: number;
	independentExecutableOccurrences: number;
	memberContexts: CloneTokenContext[];
	independentMemberIndexes: number[];
	independentExecutableMemberIndexes: number[];
	eligible: boolean;
}

export interface CloneCandidateScope {
	groups: CloneCandidateGroup[];
	executableGroups: number;
	kindPreservingGroups: number;
	equalityPreservingGroups: number;
	statementAlignedGroups: number;
	exactDataGroups: number;
	independentCopies: number;
	eligibleLines: number;
	coveredLines: number;
	density: number | null;
}

function classifyInterval(
	stream: TokenStream | undefined,
	interval: CloneTokenInterval,
	work: DuplicationWork,
): CloneTokenContext {
	const contexts = stream?.contexts;
	if (contexts === undefined) return "mixed-unknown";
	const counts = new Map<CloneTokenContext, number>();
	for (let index = interval.startToken; index < interval.endToken; index += 1) {
		work.charge();
		const context = contexts[index] ?? "mixed-unknown";
		counts.set(context, (counts.get(context) ?? 0) + 1);
	}
	if (counts.size === 1) return counts.keys().next().value ?? "mixed-unknown";
	return classifyMixedCounts(counts);
}

function classifyMixedCounts(counts: ReadonlyMap<CloneTokenContext, number>): CloneTokenContext {
	const executable = counts.get("executable-logic") ?? 0;
	const data = counts.get("literal-data") ?? 0;
	if (counts.size === 2 && executable > 0 && data > 0) {
		if (executable >= 2 * data) return "executable-logic";
		if (data >= 2 * executable) return "literal-data";
	}
	return "mixed-unknown";
}

/** Maximum-cardinality disjoint intervals on each file's token axis. */
export function selectIndependentCloneIntervals(
	intervals: readonly CloneTokenInterval[],
	work?: DuplicationWork,
): CloneTokenInterval[] {
	const ordered = [...intervals].sort((a, b) => {
		work?.charge();
		return (
			(a.path < b.path ? -1 : a.path > b.path ? 1 : 0) ||
			a.endToken - b.endToken ||
			a.startToken - b.startToken
		);
	});
	const selected: CloneTokenInterval[] = [];
	let path = "";
	let end = -1;
	for (const entry of ordered) {
		work?.charge();
		if (entry.path !== path) {
			path = entry.path;
			end = -1;
		}
		if (entry.startToken < end) continue;
		selected.push(entry);
		end = entry.endToken;
	}
	return selected;
}

function eligibleFileLines(
	file: FileSyntax,
	stream: TokenStream | undefined,
	work: DuplicationWork,
): Set<number> {
	const lines = new Set<number>();
	const kinds =
		file.language === "python"
			? file.executableLineKinds
			: (file.lineKinds ?? classifyLines(file.sourceFile));
	for (let index = 0; index < (stream?.kinds.length ?? 0); index += 1) {
		work.charge();
		if (stream?.contexts?.[index] !== "executable-logic") continue;
		const from = stream.startLines[index] ?? 1;
		const to = stream.endLines[index] ?? from;
		for (let line = from; line <= to; line += 1) {
			work.charge();
			if (kinds[line - 1] === "code") lines.add(line);
		}
	}
	return lines;
}

function eligibleLines(
	files: readonly FileSyntax[],
	streams: readonly TokenStream[],
	work: DuplicationWork,
): Map<string, Set<number>> {
	const streamByPath = new Map(streams.map((stream) => [stream.path, stream]));
	return new Map(
		files.map((file) => [file.path, eligibleFileLines(file, streamByPath.get(file.path), work)]),
	);
}

function candidateGroup(
	group: CloneGroup,
	intervals: readonly CloneTokenInterval[],
	fileByPath: ReadonlyMap<string, FileSyntax>,
	streamByPath: ReadonlyMap<string, TokenStream>,
	boundaries: Map<string, { starts: Set<number>; ends: Set<number> }>,
	work: DuplicationWork,
): { candidate: CloneCandidateGroup; executable: CloneTokenInterval[] } {
	const classified = intervals.map((interval) => ({
		interval,
		context: classifyInterval(streamByPath.get(interval.path), interval, work),
	}));
	const allIndependent = selectIndependentCloneIntervals(
		classified.map((entry) => entry.interval),
		work,
	);
	const executable = selectIndependentCloneIntervals(
		classified
			.filter((entry) => entry.context === "executable-logic")
			.map((entry) => entry.interval),
		work,
	);
	const contexts = new Set(classified.map((entry) => entry.context));
	const semanticIntervals = executable.length >= 2 ? executable : allIndependent;
	const memberIndex = new Map(intervals.map((interval, index) => [interval, index]));
	return {
		candidate: {
			id: group.id,
			...assessCloneSemantics(semanticIntervals, fileByPath, streamByPath, boundaries, work),
			context:
				contexts.size === 1 ? (contexts.values().next().value ?? "mixed-unknown") : "mixed-unknown",
			independentOccurrences: allIndependent.length,
			independentExecutableOccurrences: executable.length,
			memberContexts: classified.map((entry) => entry.context),
			independentMemberIndexes: allIndependent.map((interval) => memberIndex.get(interval) ?? -1),
			independentExecutableMemberIndexes: executable.map(
				(interval) => memberIndex.get(interval) ?? -1,
			),
			eligible: executable.length >= 2,
		},
		executable,
	};
}

function markCoveredLines(
	intervals: readonly CloneTokenInterval[],
	eligible: ReadonlyMap<string, Set<number>>,
	covered: Map<string, Set<number>>,
	work: DuplicationWork,
): void {
	for (const interval of intervals) {
		const lines = covered.get(interval.path) ?? new Set<number>();
		for (let line = interval.startLine; line <= interval.endLine; line += 1) {
			work.charge();
			if (eligible.get(interval.path)?.has(line)) lines.add(line);
		}
		covered.set(interval.path, lines);
	}
}

/** Candidate evidence only. Raw groups and scored density remain authoritative. */
export function analyzeCloneCandidates(
	files: readonly FileSyntax[],
	streams: readonly TokenStream[],
	groups: readonly CloneGroup[],
	intervals: readonly CloneTokenInterval[][],
	work: DuplicationWork,
): CloneCandidateScope {
	const streamByPath = new Map(streams.map((stream) => [stream.path, stream]));
	const fileByPath = new Map(files.map((file) => [file.path, file]));
	const boundaries = new Map<string, { starts: Set<number>; ends: Set<number> }>();
	const eligible = eligibleLines(files, streams, work);
	const covered = new Map<string, Set<number>>();
	const candidates: CloneCandidateGroup[] = [];
	let independentCopies = 0;
	for (const [index, group] of groups.entries()) {
		work.charge();
		const { candidate, executable } = candidateGroup(
			group,
			intervals[index] ?? [],
			fileByPath,
			streamByPath,
			boundaries,
			work,
		);
		candidates.push(candidate);
		if (!candidate.eligible) continue;
		independentCopies += executable.length - 1;
		markCoveredLines(executable, eligible, covered, work);
	}
	let denominator = 0;
	for (const lines of eligible.values()) denominator += lines.size;
	let numerator = 0;
	for (const lines of covered.values()) numerator += lines.size;
	return {
		groups: candidates,
		executableGroups: candidates.filter((candidate) => candidate.eligible).length,
		kindPreservingGroups: candidates.filter(
			(candidate) => candidate.eligible && candidate.kindPreserving === true,
		).length,
		equalityPreservingGroups: candidates.filter(
			(candidate) => candidate.eligible && candidate.equalityPreserving === true,
		).length,
		statementAlignedGroups: candidates.filter(
			(candidate) => candidate.eligible && candidate.statementAligned === true,
		).length,
		exactDataGroups: candidates.filter(
			(candidate) =>
				candidate.context === "literal-data" &&
				candidate.independentOccurrences >= 2 &&
				candidate.exactContentCopy === true,
		).length,
		independentCopies,
		eligibleLines: denominator,
		coveredLines: numerator,
		density: denominator === 0 ? null : numerator / denominator,
	};
}
