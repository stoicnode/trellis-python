/** Unscored executable-scope facts shared by the TypeScript and Python walkers. */
import type { Range, SourceSet } from "../contract/index.ts";

export type ExecutableUnitKind = "module" | "class" | "function";

export interface ExecutableUnit {
	path: string;
	sourceSet: SourceSet;
	language: "typescript" | "python";
	kind: ExecutableUnitKind;
	name: string;
	/** Named lexical owner; null when source structure cannot supply a stable one. */
	ownerKey: string | null;
	identityReason: string | null;
	range: Range;
	decisions: number;
	maxNesting: number;
	firstDecisionRange: Range | null;
	deepestRange: Range | null;
}

export function makeUnit(
	path: string,
	sourceSet: SourceSet,
	language: ExecutableUnit["language"],
	kind: ExecutableUnitKind,
	name: string,
	ownerKey: string | null,
	range: Range,
	identityReason: string | null = null,
): ExecutableUnit {
	return {
		path,
		sourceSet,
		language,
		kind,
		name,
		ownerKey,
		identityReason,
		range,
		decisions: 0,
		maxNesting: 0,
		firstDecisionRange: null,
		deepestRange: null,
	};
}

export function observeDecision(unit: ExecutableUnit, count: number, range: Range): void {
	if (count <= 0) return;
	unit.decisions += count;
	unit.firstDecisionRange ??= range;
}

export function observeNesting(unit: ExecutableUnit, depth: number, range: Range): void {
	if (depth <= unit.maxNesting) return;
	unit.maxNesting = depth;
	unit.deepestRange = range;
}

/** Repeated lexical owners are explicitly ambiguous, not paired by line. */
export function resolveUnitIdentity(units: readonly ExecutableUnit[]): void {
	const counts = new Map<string, number>();
	for (const unit of units) {
		if (unit.ownerKey === null) continue;
		const key = `${unit.path}\0${unit.kind}\0${unit.ownerKey}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	for (const unit of units) {
		if (unit.ownerKey === null) continue;
		const key = `${unit.path}\0${unit.kind}\0${unit.ownerKey}`;
		if ((counts.get(key) ?? 0) <= 1) continue;
		unit.ownerKey = null;
		unit.identityReason = "duplicate-owner";
	}
}
