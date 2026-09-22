import { describe, expect, test } from "bun:test";
import { type JevPacketLabel, summarizeJevPacket } from "./jev-packet-summary.ts";

function label(id: string, cost: number, refactor: number, evidence = 1): JevPacketLabel {
	return {
		id,
		maintenanceCost: cost,
		maintenanceProbabilities: { "0": 0, "1": 0, "2": 1, "3": 0 },
		refactorValue: refactor,
		evidenceSufficient: evidence,
	};
}

describe("summarizeJevPacket", () => {
	test("separates strata and languages while excluding weak evidence from actionability", () => {
		const labels = [label("pf", 2, 0.8), label("pc", 0, 0.1), label("tf", 1, 0.7, 0.2)];
		const strata = new Map([
			["pf", "flagged"],
			["pc", "matched-unflagged"],
			["tf", "flagged"],
		]);
		const languages = new Map<string, "python" | "typescript">([
			["pf", "python"],
			["pc", "python"],
			["tf", "typescript"],
		]);

		const summary = summarizeJevPacket(labels, strata, languages);

		expect(summary.overall.discrimination.maintenanceAuc).toBe(1);
		expect(summary.overall.flagged.evaluable).toBe(1);
		expect(summary.overall.flagged.actionableRate).toBe(1);
		expect(summary.byLanguage.typescript.flagged.evaluable).toBe(0);
		expect(summary.byLanguage.typescript.flagged.actionableRate).toBeNull();
	});
});
