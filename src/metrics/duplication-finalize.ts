/** Bounded materialization and containment, preserving the existing finalizer.
 * All members of a group have equal token length, so none strictly contains
 * another. Across eligible groups, a sorted per-file sweep answers strict
 * containment in O(m log m), without nested group/member scans.
 */
import {
	type CloneGroup,
	type CloneMember,
	DUPLICATION_MIN_LINES,
	type TokenStream,
} from "./duplication.ts";
import type { RawGroup, RawMember } from "./duplication-groups.ts";
import type { DuplicationWork } from "./duplication-work.ts";

interface Located extends RawMember {
	path: string;
	startLine: number;
	endLine: number;
	owner: number;
}
interface LocatedGroup {
	length: number;
	members: Located[];
	hasUncontained: boolean;
}

/** Half-open positions in one file's normalized token stream. */
export interface CloneTokenInterval {
	path: string;
	startToken: number;
	endToken: number;
	startLine: number;
	endLine: number;
}

export interface FinalizedCloneGroups {
	groups: CloneGroup[];
	intervals: CloneTokenInterval[][];
}

function locateMembers(
	group: RawGroup,
	streams: readonly TokenStream[],
	fileStart: Uint32Array,
	owner: number,
	work: DuplicationWork,
): Located[] {
	const members: Located[] = [];
	for (const member of group.members.values()) {
		work.charge(6);
		const stream = streams[member.file];
		const offset = fileStart[member.file] ?? 0;
		const startLine = stream?.startLines[member.start - offset] ?? 1;
		const endLine = stream?.endLines[member.end - offset - 1] ?? startLine;
		if (stream === undefined || endLine - startLine + 1 < DUPLICATION_MIN_LINES) continue;
		work.retainOccurrence();
		members.push({ ...member, path: stream.path, startLine, endLine, owner });
	}
	return members;
}

function locate(
	raw: Map<number, RawGroup[]>,
	streams: readonly TokenStream[],
	fileStart: Uint32Array,
	work: DuplicationWork,
): LocatedGroup[] {
	const groups: LocatedGroup[] = [];
	for (const sameLength of raw.values()) {
		work.charge();
		for (const group of sameLength) {
			work.retainGroup();
			const members = locateMembers(group, streams, fileStart, groups.length, work);
			if (members.length >= 2)
				groups.push({ length: group.length, members, hasUncontained: false });
		}
	}
	return groups;
}

function markSurvivors(groups: LocatedGroup[], work: DuplicationWork): void {
	const ordered: Located[] = [];
	for (const group of groups) {
		work.charge();
		for (const member of group.members) {
			work.reserve(2);
			ordered.push(member);
		}
	}
	ordered.sort((a, b) => {
		work.charge(3);
		return a.file - b.file || a.start - b.start || b.end - a.end;
	});
	let file = -1;
	let start = -1;
	let priorEnd = -1;
	let sameStartEnd = -1;
	for (const member of ordered) {
		work.charge(5);
		if (member.file !== file) {
			file = member.file;
			start = -1;
			priorEnd = -1;
			sameStartEnd = -1;
		}
		if (member.start !== start) {
			priorEnd = Math.max(priorEnd, sameStartEnd);
			sameStartEnd = -1;
			start = member.start;
		}
		const group = groups[member.owner];
		if (group !== undefined && priorEnd < member.end && sameStartEnd <= member.end)
			group.hasUncontained = true;
		sameStartEnd = Math.max(sameStartEnd, member.end);
	}
	work.release(ordered.length * 2);
}

function memberOrder(a: CloneMember, b: CloneMember): number {
	if (a.path !== b.path) return a.path < b.path ? -1 : 1;
	return a.range.start.line - b.range.start.line || a.range.end.line - b.range.end.line;
}

function project(
	group: LocatedGroup,
	fileStart: Uint32Array,
	work: DuplicationWork,
): { group: CloneGroup; intervals: CloneTokenInterval[] } {
	work.retainGroup();
	const members: { clone: CloneMember; interval: CloneTokenInterval }[] = [];
	for (const member of group.members) {
		work.retainOccurrence();
		const offset = fileStart[member.file] ?? 0;
		members.push({
			clone: {
				path: member.path,
				range: { start: { line: member.startLine }, end: { line: member.endLine } },
				tokenCount: group.length,
				lineCount: member.endLine - member.startLine + 1,
			},
			interval: {
				path: member.path,
				startToken: member.start - offset,
				endToken: member.end - offset,
				startLine: member.startLine,
				endLine: member.endLine,
			},
		});
	}
	members.sort((a, b) => {
		work.charge();
		return memberOrder(a.clone, b.clone);
	});
	return {
		group: { id: "", tokenCount: group.length, members: members.map((entry) => entry.clone) },
		intervals: members.map((entry) => entry.interval),
	};
}

function groupOrder(a: CloneGroup, b: CloneGroup): number {
	const firstA = a.members[0];
	const firstB = b.members[0];
	if (firstA === undefined || firstB === undefined) return 0;
	return (
		memberOrder(firstA, firstB) ||
		b.tokenCount - a.tokenCount ||
		b.members.length - a.members.length
	);
}

export function finalizeCandidateGroupsDetailed(
	raw: Map<number, RawGroup[]>,
	streams: readonly TokenStream[],
	fileStart: Uint32Array,
	work: DuplicationWork,
): FinalizedCloneGroups {
	work.enter("materialization");
	const located = locate(raw, streams, fileStart, work);
	work.enter("finalization");
	markSurvivors(located, work);
	const projected: ReturnType<typeof project>[] = [];
	for (const group of located) {
		work.charge();
		if (group.hasUncontained) projected.push(project(group, fileStart, work));
	}
	projected.sort((a, b) => {
		work.charge();
		return groupOrder(a.group, b.group);
	});
	for (const [index, entry] of projected.entries()) {
		work.charge();
		entry.group.id = `clone-group-${index + 1}`;
	}
	work.checkpoint();
	return {
		groups: projected.map((entry) => entry.group),
		intervals: projected.map((entry) => entry.intervals),
	};
}

/** Compatibility entry point for direct finalization callers. */
export function finalizeCandidateGroups(
	raw: Map<number, RawGroup[]>,
	streams: readonly TokenStream[],
	fileStart: Uint32Array,
	work: DuplicationWork,
): CloneGroup[] {
	return finalizeCandidateGroupsDetailed(raw, streams, fileStart, work).groups;
}
