/** Maximal LCP intervals, with linear context counting instead of occurrence pairs.
 * A member participates exactly when another occurrence differs on BOTH sides.
 * Inclusion/exclusion of left/right context counts tests that without a Cartesian product.
 */
import { DUPLICATION_MIN_TOKENS } from "./duplication.ts";
import type { RawGroup, RawMember } from "./duplication-groups.ts";
import type { RankedTokens } from "./duplication-index-input.ts";
import type { DuplicationWork } from "./duplication-work.ts";

interface LeftContextIndex {
	minimum: Uint32Array;
	maximum: Uint32Array;
	size: number;
}

function leftContext(data: RankedTokens, position: number): number {
	const file = data.fileOf[position] ?? 0;
	return position === data.fileStart[file] ? -file - 1 : (data.tokens[position - 1] ?? 0);
}

function buildLeftContextIndex(
	data: RankedTokens,
	sa: Uint32Array,
	work: DuplicationWork,
): LeftContextIndex {
	let size = 1;
	while (size < sa.length) {
		work.charge();
		size *= 2;
	}
	work.reserve(size * 2);
	const minimum = new Uint32Array(size * 2);
	work.reserve(size * 2);
	const maximum = new Uint32Array(size * 2);
	minimum.fill(0xffffffff);
	const offset = data.fileStart.length + 1;
	for (let rank = 0; rank < sa.length; rank += 1) {
		work.charge(2);
		const value = leftContext(data, sa[rank] ?? 0) + offset;
		minimum[size + rank] = value;
		maximum[size + rank] = value;
	}
	for (let index = size - 1; index > 0; index -= 1) {
		work.charge(2);
		minimum[index] = Math.min(
			minimum[index * 2] ?? 0xffffffff,
			minimum[index * 2 + 1] ?? 0xffffffff,
		);
		maximum[index] = Math.max(maximum[index * 2] ?? 0, maximum[index * 2 + 1] ?? 0);
	}
	return { minimum, maximum, size };
}

function contextRange(
	index: LeftContextIndex,
	begin: number,
	end: number,
	work: DuplicationWork,
): { minimum: number; maximum: number } {
	let minimum = 0xffffffff;
	let maximum = 0;
	for (
		let left = begin + index.size, right = end + index.size;
		left < right;
		left >>= 1, right >>= 1
	) {
		work.charge(2);
		if (left & 1) {
			minimum = Math.min(minimum, index.minimum[left] ?? 0xffffffff);
			maximum = Math.max(maximum, index.maximum[left] ?? 0);
			left += 1;
		}
		if (right & 1) {
			right -= 1;
			minimum = Math.min(minimum, index.minimum[right] ?? 0xffffffff);
			maximum = Math.max(maximum, index.maximum[right] ?? 0);
		}
	}
	return { minimum, maximum };
}

function memberAt(data: RankedTokens, start: number, length: number): RawMember {
	return { file: data.fileOf[start] ?? 0, start, end: start + length };
}

function rightContext(data: RankedTokens, sa: Uint32Array, rank: number, length: number): number {
	return data.tokens[(sa[rank] ?? 0) + length] ?? 0;
}

/** Right contexts are contiguous in suffix-array order below one LCP interval. */
function rightGroupEnd(
	data: RankedTokens,
	sa: Uint32Array,
	begin: number,
	end: number,
	length: number,
	work: DuplicationWork,
): number {
	const right = rightContext(data, sa, begin, length);
	let low = begin + 1;
	let high = end;
	while (low < high) {
		work.charge(2);
		const middle = low + Math.floor((high - low) / 2);
		if (rightContext(data, sa, middle, length) <= right) low = middle + 1;
		else high = middle;
	}
	return low;
}

function appendQualifiedMembers(
	data: RankedTokens,
	sa: Uint32Array,
	begin: number,
	end: number,
	length: number,
	minimum: number,
	maximum: number,
	work: DuplicationWork,
	group: RawGroup | undefined,
): RawGroup | undefined {
	if (minimum === 0xffffffff) return group;
	for (let rank = begin; rank < end; rank += 1) {
		work.charge(2);
		const start = sa[rank] ?? 0;
		const left = leftContext(data, start) + data.fileStart.length + 1;
		if (minimum === left && maximum === left) continue;
		work.retainOccurrence();
		const member = memberAt(data, start, length);
		if (group === undefined) {
			work.retainGroup();
			group = { length, rep: member, members: new Map() };
		}
		if (member.start < group.rep.start) group.rep = member;
		group.members.set(`${member.file}:${member.start}`, member);
	}
	return group;
}

function intervalMembers(
	data: RankedTokens,
	sa: Uint32Array,
	begin: number,
	end: number,
	length: number,
	leftContexts: LeftContextIndex,
	work: DuplicationWork,
): RawGroup | undefined {
	let group: RawGroup | undefined;
	for (let rightBegin = begin; rightBegin < end; ) {
		const rightEnd = rightGroupEnd(data, sa, rightBegin, end, length, work);
		const before = contextRange(leftContexts, begin, rightBegin, work);
		const after = contextRange(leftContexts, rightEnd, end, work);
		const minimum = Math.min(before.minimum, after.minimum);
		const maximum = Math.max(before.maximum, after.maximum);
		group = appendQualifiedMembers(
			data,
			sa,
			rightBegin,
			rightEnd,
			length,
			minimum,
			maximum,
			work,
			group,
		);
		rightBegin = rightEnd;
	}
	return group;
}

function emitInterval(
	data: RankedTokens,
	sa: Uint32Array,
	begin: number,
	end: number,
	length: number,
	leftContexts: LeftContextIndex,
	groups: Map<number, RawGroup[]>,
	work: DuplicationWork,
): void {
	work.charge();
	work.extractionIntervals += 1;
	work.extractionIntervalOccurrences += end - begin;
	if (end - begin < 2) return;
	const contexts = contextRange(leftContexts, begin, end, work);
	if (contexts.minimum === contexts.maximum) return;
	const group = intervalMembers(data, sa, begin, end, length, leftContexts, work);
	if (group !== undefined) {
		work.charge();
		const sameLength = groups.get(length) ?? [];
		sameLength.push(group);
		groups.set(length, sameLength);
	}
}

interface IntervalStack {
	starts: Uint32Array;
	depths: Uint32Array;
	size: number;
}

function closeIntervals(
	stack: IntervalStack,
	depth: number,
	rank: number,
	data: RankedTokens,
	sa: Uint32Array,
	leftContexts: LeftContextIndex,
	groups: Map<number, RawGroup[]>,
	work: DuplicationWork,
): number {
	let begin = rank - 1;
	while (stack.size > 0 && (stack.depths[stack.size - 1] ?? 0) > depth) {
		work.charge(3);
		stack.size -= 1;
		begin = stack.starts[stack.size] ?? 0;
		emitInterval(data, sa, begin, rank, stack.depths[stack.size] ?? 0, leftContexts, groups, work);
	}
	return begin;
}

/** A single stack sweep visits every branching LCP interval once. */
export function extractCloneGroups(
	data: RankedTokens,
	sa: Uint32Array,
	lcp: Uint32Array,
	work: DuplicationWork,
): Map<number, RawGroup[]> {
	work.enter("extraction");
	const starts = work.array(sa.length);
	const depths = work.array(sa.length);
	const leftContexts = buildLeftContextIndex(data, sa, work);
	const groups = new Map<number, RawGroup[]>();
	const stack: IntervalStack = { starts, depths, size: 0 };
	for (let rank = 1; rank <= sa.length; rank += 1) {
		work.extractionRank = rank;
		work.charge(3);
		const depth = lcp[rank] ?? 0;
		const begin = closeIntervals(stack, depth, rank, data, sa, leftContexts, groups, work);
		if (
			depth >= DUPLICATION_MIN_TOKENS &&
			(stack.size === 0 || (depths[stack.size - 1] ?? 0) < depth)
		) {
			work.charge(2);
			starts[stack.size] = begin;
			depths[stack.size++] = depth;
		}
	}
	work.release(starts.length + depths.length);
	work.release(leftContexts.minimum.length + leftContexts.maximum.length);
	work.checkpoint();
	return groups;
}
