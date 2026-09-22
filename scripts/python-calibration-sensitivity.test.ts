import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCORING_FORMULA } from "../src/scoring/formula.ts";
import { analyze } from "./python-calibration-sensitivity.ts";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("python calibration sensitivity", () => {
	test("withholds every scenario for an incomplete dimension and skips pair ranking", () => {
		const root = mkdtempSync(join(tmpdir(), "trellis-sensitivity-"));
		roots.push(root);
		const metrics = Object.fromEntries(
			SCORING_FORMULA.dimensions.flatMap((dimension) =>
				dimension.terms.map((term) => [
					term.metricId,
					{ id: term.metricId, state: "complete", value: 0 },
				]),
			),
		);
		const incomplete: Record<string, { id: string; state: string; value?: number }> =
			structuredClone(metrics);
		const firstTerm = SCORING_FORMULA.dimensions[0]?.terms[0];
		if (firstTerm === undefined) throw new Error("formula has no terms");
		incomplete[firstTerm.metricId] = { id: firstTerm.metricId, state: "unknown" };
		const input = join(root, "measurement.json");
		writeFileSync(
			input,
			JSON.stringify({
				scopes: [
					{ repository: "complete", scope: "complete", runs: [{ metrics, score: { index: 0 } }] },
					{
						repository: "incomplete",
						scope: "incomplete",
						runs: [{ metrics: incomplete, score: { index: null } }],
					},
				],
			}),
		);
		const result = analyze(input) as {
			scopes: Array<{ range: [number, number] | null; results: Array<{ index: number | null }> }>;
			comparisons: Array<{ eligiblePairs: number }>;
		};
		expect(result.scopes[0]?.range).toEqual([0, 0]);
		expect(result.scopes[1]?.range).toBeNull();
		expect(result.scopes[1]?.results.every((scenario) => scenario.index === null)).toBe(true);
		expect(result.comparisons.every((comparison) => comparison.eligiblePairs === 0)).toBe(true);
	});
});
