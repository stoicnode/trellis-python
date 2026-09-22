export interface JevPacketLabel {
	id: string;
	maintenanceCost: number;
	maintenanceProbabilities: Readonly<Record<string, number>>;
	refactorValue: number;
	evidenceSufficient: number;
}

function mean(values: readonly number[]): number | null {
	return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function auc(
	positive: readonly JevPacketLabel[],
	negative: readonly JevPacketLabel[],
	value: (label: JevPacketLabel) => number,
): number | null {
	if (positive.length === 0 || negative.length === 0) return null;
	let wins = 0;
	for (const left of positive) {
		for (const right of negative) {
			const delta = value(left) - value(right);
			wins += delta > 0 ? 1 : delta === 0 ? 0.5 : 0;
		}
	}
	return wins / (positive.length * negative.length);
}

function summarizeSlice(labels: readonly JevPacketLabel[], strata: ReadonlyMap<string, string>) {
	function group(stratum: string) {
		const grouped = labels.filter((label) => strata.get(label.id) === stratum);
		const evaluable = grouped.filter((label) => label.evidenceSufficient >= 0.5);
		const actionable = evaluable.filter((label) => {
			const material =
				(label.maintenanceProbabilities["2"] ?? 0) + (label.maintenanceProbabilities["3"] ?? 0);
			return material >= 0.5 && label.refactorValue >= 0.5;
		});
		return {
			samples: grouped.length,
			evaluable: evaluable.length,
			evidenceCoverage: grouped.length === 0 ? null : evaluable.length / grouped.length,
			meanMaintenanceCost: mean(grouped.map((label) => label.maintenanceCost)),
			meanRefactorValue: mean(grouped.map((label) => label.refactorValue)),
			evaluableMeanMaintenanceCost: mean(evaluable.map((label) => label.maintenanceCost)),
			evaluableMeanRefactorValue: mean(evaluable.map((label) => label.refactorValue)),
			actionableRate: evaluable.length === 0 ? null : actionable.length / evaluable.length,
		};
	}
	const flagged = labels.filter((label) => strata.get(label.id) === "flagged");
	const controls = labels.filter((label) => strata.get(label.id) === "matched-unflagged");
	return {
		flagged: group("flagged"),
		matchedUnflagged: group("matched-unflagged"),
		discrimination: {
			maintenanceAuc: auc(flagged, controls, (label) => label.maintenanceCost),
			refactorValueAuc: auc(flagged, controls, (label) => label.refactorValue),
		},
	};
}

export function summarizeJevPacket(
	labels: readonly JevPacketLabel[],
	strata: ReadonlyMap<string, string>,
	languages: ReadonlyMap<string, "python" | "typescript">,
) {
	return {
		overall: summarizeSlice(labels, strata),
		byLanguage: {
			python: summarizeSlice(
				labels.filter((label) => languages.get(label.id) === "python"),
				strata,
			),
			typescript: summarizeSlice(
				labels.filter((label) => languages.get(label.id) === "typescript"),
				strata,
			),
		},
	};
}
