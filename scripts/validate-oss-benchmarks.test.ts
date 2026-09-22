import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadOssBenchmarkManifest, runOssBenchmark } from "./validate-oss-benchmarks.ts";

const ROOT = resolve(import.meta.dir, "../corpus/oss-benchmark");

describe("open-source benchmark baseline", () => {
	test("freezes the pinned external baseline and audits every distilled taxonomy fixture", async () => {
		const manifest = loadOssBenchmarkManifest(ROOT);
		expect(manifest.repositories.map((entry) => entry.id)).toEqual([
			"zod",
			"date-fns",
			"tanstack-query",
			"requests",
			"flask",
			"rich",
		]);
		expect(manifest.baselines.find((entry) => entry.id === "rich")).toMatchObject({
			index: 100,
			completeness: "incomplete",
			unresolvedReasons: { "no-target": 578, "non-literal-dynamic": 3 },
		});
		const record = await runOssBenchmark(ROOT);
		expect(record.ok).toBe(true);
		expect(record.fixtures.map((fixture) => fixture.id)).toEqual([
			"parser-recovery",
			"indentation",
			"static-import-uncertainty",
			"unsupported-exports",
			"resource-exhaustion",
		]);
		for (const fixture of record.fixtures) {
			expect(fixture.snapshot.matches).toBe(true);
			expect(fixture.measurement.durationMs).toBeGreaterThanOrEqual(0);
			expect(fixture.measurement.peakRssMb).toBeGreaterThan(0);
			expect(fixture.scoreContributions.length).toBeGreaterThan(0);
		}
		const byId = Object.fromEntries(record.fixtures.map((fixture) => [fixture.id, fixture]));
		expect(byId["parser-recovery"]?.completeness).toBe("incomplete");
		expect(byId["parser-recovery"]?.diagnosticCodes).toContain("PY-SYNTAX");
		expect(byId.indentation?.completeness).toBe("incomplete");
		expect(byId.indentation?.diagnosticCodes).toContain("PY-INDENT");
		expect(byId["static-import-uncertainty"]?.unresolvedReasons).toEqual({
			"non-literal-dynamic": 1,
		});
		expect(byId["unsupported-exports"]?.unresolvedReasons).toEqual({ "unsupported-exports": 1 });
		for (const id of [
			"duplication.groups.production",
			"duplication.duplicated-lines.production",
			"duplication.density.production",
		]) {
			expect(byId["resource-exhaustion"]?.metrics[id]).toMatchObject({
				state: "incomplete",
				reason: expect.stringContaining("match-work budget"),
			});
		}
	});
});
