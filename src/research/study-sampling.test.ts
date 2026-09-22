import { describe, expect, test } from "bun:test";
import { buildStudySample, type StudyUnit } from "./study-sampling.ts";

function units(): StudyUnit[] {
	return ["alpha", "beta"].flatMap((repository) =>
		Array.from({ length: 24 }, (_, index) => ({
			id: `${repository}-${index}`,
			repository,
			language: repository === "alpha" ? ("python" as const) : ("typescript" as const),
			role: "library" as const,
			path: `src/${index}.ts`,
			kind: index % 2 === 0 ? "function" : "module",
			sizeBucket: index % 3 === 0 ? ("large" as const) : ("small" as const),
			flagKinds: index < 12 ? ["complexity.hotspot"] : [],
		})),
	);
}

describe("buildStudySample", () => {
	test("selects deterministic balanced blinded strata", () => {
		const first = buildStudySample(units(), "fixed-seed");
		const second = buildStudySample([...units()].reverse(), "fixed-seed");
		expect(first).toEqual(second);
		expect(first.reviewerPacket).toHaveLength(40);
		expect(first.reviewerPacket.every((unit) => !("flagKinds" in unit))).toBeTrue();
		for (const repository of ["alpha", "beta"]) {
			const key = first.answerKey.filter((unit) => unit.unitId.startsWith(`${repository}-`));
			expect(key.filter((unit) => unit.stratum === "flagged")).toHaveLength(10);
			expect(key.filter((unit) => unit.stratum === "matched-unflagged")).toHaveLength(10);
		}
	});

	test("fails closed when either sampling population is short", () => {
		expect(() => buildStudySample(units().slice(0, 9), "fixed-seed")).toThrow("needs 10 flagged");
		expect(() => buildStudySample(units().slice(0, 18), "fixed-seed")).toThrow(
			"needs 10 unflagged",
		);
	});
});
