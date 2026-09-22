/** Single bounded native engine, promoted after trellis-b594 acceptance.
 * Candidate names retain the acceptance harness seam; there is no runtime engine selector. */
import type { FileSyntax } from "../syntax/index.ts";
import { analyzeCloneCandidates, type CloneCandidateScope } from "./clone-candidates.ts";
import { type CloneGroup, collectControlledTokens, type TokenStream } from "./duplication.ts";
import { accountCandidateLines } from "./duplication-account.ts";
import { extractCloneGroups } from "./duplication-extract.ts";
import {
	type CloneTokenInterval,
	type FinalizedCloneGroups,
	finalizeCandidateGroupsDetailed,
} from "./duplication-finalize.ts";
import { rankTokenStreams } from "./duplication-index-input.ts";
import { orderRawGroups } from "./duplication-order.ts";
import { longestCommonPrefixes, suffixArray } from "./duplication-suffix.ts";
import {
	DuplicationLimitError,
	type DuplicationStop,
	DuplicationWork,
	type DuplicationWorkOptions,
} from "./duplication-work.ts";

export interface CandidateDetection {
	diagnosticFiles: string[];
	groups: CloneGroup[];
	/** Exact per-file token intervals aligned to groups and their members. */
	intervals: CloneTokenInterval[][];
	/** Advisory executable-copy population; absent for stream-only detection or incomplete work. */
	candidate: CloneCandidateScope | null;
	/** Independent advisory resource stop; raw groups and totals remain committed. */
	candidateExhaustion: DuplicationStop | null;
	tokenCount: number;
	exhaustion: DuplicationStop | null;
	/** Null when line accounting was not requested or the pass was incomplete. */
	totals: ReturnType<typeof accountCandidateLines> | null;
	work: {
		total: number;
		phases: DuplicationWork["counts"];
		peakCells: number;
		groups: number;
		occurrences: number;
		extractionIntervals: number;
		extractionIntervalOccurrences: number;
		extractionRank: number;
	};
}

function collectFiles(files: readonly FileSyntax[], work: DuplicationWork) {
	work.enter("input");
	if (files.length > work.limits.maxStreams) work.stop("maxStreams", work.limits.maxStreams);
	const streams: TokenStream[] = [];
	const diagnosticFiles: string[] = [];
	const sourceSet = files[0]?.sourceSet;
	const control = {
		charge: (units = 1) => work.charge(units),
		reserve: (cells: number) => work.reserve(cells),
		release: (cells: number) => work.release(cells),
		token: () => {
			work.inputTokens += 1;
			if (work.inputTokens > work.limits.maxTokens) work.stop("maxTokens", work.limits.maxTokens);
			work.reserve(3);
		},
	};
	for (const file of files) {
		work.charge();
		if (file.sourceSet !== sourceSet) throw new Error("Duplication requires one source set");
		if (file.diagnostics.length > 0) {
			work.reserve(2);
			diagnosticFiles.push(file.path);
		}
		streams.push(collectControlledTokens(file, control));
	}
	diagnosticFiles.sort((a, b) => {
		work.charge();
		return a < b ? -1 : a > b ? 1 : 0;
	});
	work.checkpoint();
	return { streams, diagnosticFiles };
}

function detect(streams: readonly TokenStream[], work: DuplicationWork): FinalizedCloneGroups {
	work.enter("input");
	if (streams.length > work.limits.maxStreams) work.stop("maxStreams", work.limits.maxStreams);
	const sourceSet = streams[0]?.sourceSet;
	for (const stream of streams) {
		work.charge();
		if (stream.sourceSet !== sourceSet) throw new Error("Duplication requires one source set");
	}
	const data = rankTokenStreams(streams, work);
	if (data.tokens.length === 0) return { groups: [], intervals: [] };
	const sa = suffixArray(data.tokens, data.alphabetSize, work);
	const lcp = longestCommonPrefixes(data.tokens, sa, work);
	const raw = extractCloneGroups(data, sa, lcp, work);
	orderRawGroups(raw, streams, data, work);
	return finalizeCandidateGroupsDetailed(raw, streams, data.fileStart, work);
}

function result(
	work: DuplicationWork,
	groups: CloneGroup[],
	intervals: CloneTokenInterval[][],
	candidate: CloneCandidateScope | null,
	candidateExhaustion: DuplicationStop | null,
	totals: CandidateDetection["totals"],
	exhaustion: DuplicationStop | null,
	diagnosticFiles: string[] = [],
): CandidateDetection {
	return {
		diagnosticFiles,
		groups,
		intervals,
		candidate,
		candidateExhaustion,
		totals,
		exhaustion,
		tokenCount: work.inputTokens,
		work: {
			total: work.total,
			phases: { ...work.counts },
			peakCells: work.peakCells,
			groups: work.groups,
			occurrences: work.occurrences,
			extractionIntervals: work.extractionIntervals,
			extractionIntervalOccurrences: work.extractionIntervalOccurrences,
			extractionRank: work.extractionRank,
		},
	};
}

/** Only a budget/cancellation stop becomes incomplete. No partial groups escape. */
function run(
	work: DuplicationWork,
	operation: () => {
		groups: CloneGroup[];
		intervals: CloneTokenInterval[][];
		candidate?: CloneCandidateScope | null;
		candidateExhaustion?: DuplicationStop | null;
		totals: CandidateDetection["totals"];
		diagnosticFiles?: string[];
	},
): CandidateDetection {
	try {
		work.checkpoint();
		const { groups, intervals, candidate, candidateExhaustion, totals, diagnosticFiles } =
			operation();
		work.checkpoint();
		return result(
			work,
			groups,
			intervals,
			candidate ?? null,
			candidateExhaustion ?? null,
			totals,
			null,
			diagnosticFiles,
		);
	} catch (error) {
		if (!(error instanceof DuplicationLimitError)) throw error;
		return result(work, [], [], null, null, null, error.exhaustion);
	}
}

export function detectCandidateClones(
	streams: readonly TokenStream[],
	options: DuplicationWorkOptions = {},
): CandidateDetection {
	const work = new DuplicationWork(options);
	return run(work, () => ({ ...detect(streams, work), totals: null }));
}

function evaluateCandidateView(
	files: readonly FileSyntax[],
	streams: readonly TokenStream[],
	detected: FinalizedCloneGroups,
	options: DuplicationWorkOptions,
	rawLiveCells: number,
): Pick<CandidateDetection, "candidate" | "candidateExhaustion"> {
	const work = new DuplicationWork(options);
	try {
		work.enter("finalization");
		work.reserve(
			rawLiveCells + streams.reduce((count, stream) => count + stream.kinds.length * 4, 0),
		);
		const candidate = analyzeCloneCandidates(
			files,
			streams,
			detected.groups,
			detected.intervals,
			work,
		);
		work.checkpoint();
		return { candidate, candidateExhaustion: null };
	} catch (error) {
		if (!(error instanceof DuplicationLimitError)) throw error;
		if (error.exhaustion.kind === "cancelled") throw error;
		return { candidate: null, candidateExhaustion: error.exhaustion };
	}
}

/** Collection, detection, materialization, containment and line unions share one budget. */
export function measureCandidateScope(
	files: readonly FileSyntax[],
	options: DuplicationWorkOptions = {},
): CandidateDetection {
	const work = new DuplicationWork(options);
	return run(work, () => {
		const { streams, diagnosticFiles } = collectFiles(files, work);
		const detected = detect(streams, work);
		const totals = accountCandidateLines(files, detected.groups, work);
		const candidateView = evaluateCandidateView(files, streams, detected, options, work.liveCells);
		return {
			...detected,
			totals,
			...candidateView,
			diagnosticFiles,
		};
	});
}
