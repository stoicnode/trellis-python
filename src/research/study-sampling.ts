/** Deterministic blinded sampling for the independent index utility pilot. */
import { createHash } from "node:crypto";

export interface StudyUnit {
	id: string;
	repository: string;
	language: "python" | "typescript";
	role: "library" | "framework" | "developer-tool";
	path: string;
	kind: string;
	sizeBucket: "small" | "medium" | "large";
	flagKinds: string[];
}

export interface ReviewerUnit {
	blindId: string;
	repository: string;
	language: StudyUnit["language"];
	role: StudyUnit["role"];
	path: string;
	kind: string;
	sizeBucket: StudyUnit["sizeBucket"];
}

export interface StudySample {
	reviewerPacket: ReviewerUnit[];
	answerKey: Array<{
		blindId: string;
		unitId: string;
		stratum: "flagged" | "matched-unflagged";
		flagKinds: string[];
	}>;
}

function hash(seed: string, domain: string, value: string): string {
	return createHash("sha256").update(`${seed}\0${domain}\0${value}`).digest("hex");
}

function ordered(units: readonly StudyUnit[], seed: string, domain: string): StudyUnit[] {
	return [...units].sort(
		(a, b) =>
			hash(seed, domain, a.id).localeCompare(hash(seed, domain, b.id)) || a.id.localeCompare(b.id),
	);
}

function similarity(flagged: StudyUnit, candidate: StudyUnit): number {
	return (
		Number(flagged.kind !== candidate.kind) + Number(flagged.sizeBucket !== candidate.sizeBucket)
	);
}

function matchControls(
	flagged: readonly StudyUnit[],
	pool: readonly StudyUnit[],
	seed: string,
): StudyUnit[] {
	const available = new Map(pool.map((unit) => [unit.id, unit]));
	return flagged.flatMap((unit, index) => {
		const match = ordered([...available.values()], seed, `control-${index}`).sort(
			(a, b) => similarity(unit, a) - similarity(unit, b),
		)[0];
		if (match === undefined) return [];
		available.delete(match.id);
		return [match];
	});
}

/** Ten signal-positive units plus ten kind/size-matched controls per repository. */
export function buildStudySample(
	units: readonly StudyUnit[],
	seed: string,
	perStratum = 10,
): StudySample {
	const repositories = [...new Set(units.map((unit) => unit.repository))].sort();
	const selected = repositories.flatMap((repository) => {
		const owned = units.filter((unit) => unit.repository === repository);
		const flagged = ordered(
			owned.filter((unit) => unit.flagKinds.length > 0),
			seed,
			`${repository}-flagged`,
		).slice(0, perStratum);
		if (flagged.length !== perStratum)
			throw new Error(`${repository}: needs ${perStratum} flagged units, found ${flagged.length}`);
		const controls = matchControls(
			flagged,
			owned.filter((unit) => unit.flagKinds.length === 0),
			`${seed}-${repository}`,
		);
		if (controls.length !== perStratum)
			throw new Error(
				`${repository}: needs ${perStratum} unflagged units, found ${controls.length}`,
			);
		return [
			...flagged.map((unit) => ({ unit, stratum: "flagged" as const })),
			...controls.map((unit) => ({ unit, stratum: "matched-unflagged" as const })),
		];
	});
	const keyed = selected.map(({ unit, stratum }) => ({
		unit,
		stratum,
		blindId: hash(seed, "blind", unit.id).slice(0, 16),
	}));
	return {
		reviewerPacket: ordered(
			keyed.map(({ unit }) => unit),
			seed,
			"packet-order",
		).map((unit) => ({
			blindId: hash(seed, "blind", unit.id).slice(0, 16),
			repository: unit.repository,
			language: unit.language,
			role: unit.role,
			path: unit.path,
			kind: unit.kind,
			sizeBucket: unit.sizeBucket,
		})),
		answerKey: keyed
			.map(({ unit, stratum, blindId }) => ({
				blindId,
				unitId: unit.id,
				stratum,
				flagKinds: [...unit.flagKinds].sort(),
			}))
			.sort((a, b) => a.blindId.localeCompare(b.blindId)),
	};
}
