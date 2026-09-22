/** Unscored executable ownership and located nesting over the shared parse. */
import type { Finding, MetricValue } from "../contract/index.ts";
import type { FileSyntax, SyntaxInventory } from "../syntax/index.ts";
import { pythonExecutableUnits } from "./executable-scopes-python.ts";
import { typescriptExecutableUnits } from "./executable-scopes-typescript.ts";
import { type ExecutableUnit, resolveUnitIdentity } from "./executable-units.ts";
import { metric } from "./metric-value.ts";

/** Three control levels expose a located finding even below the CC 11 cutoff. */
export const NESTING_REVIEW_DEPTH = 3;

export interface ExecutableScopeAnalysis {
	metrics: MetricValue[];
	findings: Finding[];
}

function fileUnits(file: FileSyntax): ExecutableUnit[] {
	return file.language === "python" ? pythonExecutableUnits(file) : typescriptExecutableUnits(file);
}

function unitFacts(unit: ExecutableUnit): Record<string, unknown> {
	return {
		language: unit.language,
		sourceSet: unit.sourceSet,
		ownerKind: unit.kind,
		ownerName: unit.name,
		ownerKey: unit.ownerKey,
		identityState: unit.ownerKey === null ? "ambiguous" : "identified",
		identityReason: unit.identityReason,
		decisions: unit.decisions,
		maxNesting: unit.maxNesting,
	};
}

function unitFindings(unit: ExecutableUnit): Finding[] {
	const findings: Finding[] = [];
	if (unit.kind !== "function" && unit.decisions > 0) {
		findings.push({
			kind: "executable.initialization",
			path: unit.path,
			range: unit.firstDecisionRange ?? unit.range,
			summary: `${unit.kind} initialization contains ${unit.decisions} decision(s)`,
			facts: unitFacts(unit),
		});
	}
	if (unit.maxNesting >= NESTING_REVIEW_DEPTH) {
		findings.push({
			kind: "executable.nesting",
			path: unit.path,
			range: unit.deepestRange ?? unit.range,
			summary: `${unit.kind} ${unit.name} reaches control nesting depth ${unit.maxNesting}`,
			facts: { ...unitFacts(unit), reviewDepth: NESTING_REVIEW_DEPTH },
		});
	}
	return findings;
}

function scopeMetrics(
	set: "production" | "test",
	files: readonly FileSyntax[],
	units: readonly ExecutableUnit[],
): MetricValue[] {
	const initialization = units.filter((unit) => unit.kind !== "function");
	const worstInitialization = [...initialization].sort(
		(a, b) =>
			b.decisions - a.decisions ||
			a.path.localeCompare(b.path) ||
			a.range.start.line - b.range.start.line,
	)[0];
	const deepest = [...units].sort(
		(a, b) =>
			b.maxNesting - a.maxNesting ||
			a.path.localeCompare(b.path) ||
			a.range.start.line - b.range.start.line,
	)[0];
	const diagnosticFiles = files.filter((file) => file.diagnostics.length > 0).length;
	const reason =
		diagnosticFiles === 0
			? undefined
			: `${diagnosticFiles} ${set} file(s) produced parse diagnostics; executable scope values are partial`;
	return [
		metric(
			`executable.initialization.decisions.${set}`,
			"count",
			initialization.reduce((n, unit) => n + unit.decisions, 0),
			reason,
		),
		metric(`executable.initialization.units.${set}`, "count", initialization.length, reason),
		metric(
			`executable.initialization.max-decisions.${set}`,
			"count",
			worstInitialization?.decisions ?? null,
			reason,
			worstInitialization === undefined
				? undefined
				: { detail: { worst: unitLocation(worstInitialization) } },
		),
		metric(
			`executable.nesting.findings.${set}`,
			"count",
			units.filter((unit) => unit.maxNesting >= NESTING_REVIEW_DEPTH).length,
			reason,
			{ detail: { reviewDepth: NESTING_REVIEW_DEPTH } },
		),
		metric(
			`executable.nesting.max.${set}`,
			"depth",
			deepest?.maxNesting ?? null,
			reason,
			deepest === undefined ? undefined : { detail: { worst: unitLocation(deepest) } },
		),
	];
}

function unitLocation(unit: ExecutableUnit): Record<string, unknown> {
	return {
		path: unit.path,
		ownerKind: unit.kind,
		ownerName: unit.name,
		ownerKey: unit.ownerKey,
	};
}

/** Advisory only: no metric here is an input to the score catalog. */
export function analyzeExecutableScopes(inventory: SyntaxInventory): ExecutableScopeAnalysis {
	const files = inventory.files.filter(
		(file) => file.sourceSet === "production" || file.sourceSet === "test",
	);
	const units = files.flatMap(fileUnits);
	resolveUnitIdentity(units);
	return {
		metrics: (["production", "test"] as const)
			.flatMap((set) =>
				scopeMetrics(
					set,
					files.filter((file) => file.sourceSet === set),
					units.filter((unit) => unit.sourceSet === set),
				),
			)
			.sort((a, b) => a.id.localeCompare(b.id)),
		findings: units
			.flatMap(unitFindings)
			.sort(
				(a, b) =>
					a.kind.localeCompare(b.kind) ||
					a.path.localeCompare(b.path) ||
					a.range.start.line - b.range.start.line,
			),
	};
}
