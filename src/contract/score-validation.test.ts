import { afterEach, describe, expect, test } from "bun:test";
import { auditFixture, type FixtureReport } from "../report/audit-fixtures.ts";
import { auditReportSchema } from "./report.ts";

let fixture: FixtureReport | undefined;

afterEach(async () => {
	await fixture?.cleanup();
	fixture = undefined;
});

describe("current report score honesty", () => {
	test("rejects a complete audit that omits unknownDimensions or withholds its index", async () => {
		fixture = await auditFixture("clean");
		const report = fixture.report;
		const { unknownDimensions: _unknown, ...withoutDeclaration } = report.score;
		expect(auditReportSchema.safeParse({ ...report, score: withoutDeclaration }).success).toBe(
			false,
		);
		expect(
			auditReportSchema.safeParse({ ...report, score: { ...report.score, index: null } }).success,
		).toBe(false);
	});

	test("rejects duplicate or untraceable unknown dimensions in an incomplete audit", async () => {
		fixture = await auditFixture("incomplete");
		const report = fixture.report;
		const unknown = report.score.unknownDimensions ?? [];
		const dimension = unknown[0];
		if (dimension === undefined) throw new Error("expected an unknown scored dimension");
		expect(auditReportSchema.safeParse(report).success).toBe(true);
		expect(
			auditReportSchema.safeParse({
				...report,
				score: { ...report.score, unknownDimensions: [...unknown, dimension] },
			}).success,
		).toBe(false);
		expect(
			auditReportSchema.safeParse({
				...report,
				score: { ...report.score, unknownDimensions: [...unknown, "unmeasured-dimension"] },
			}).success,
		).toBe(false);
	});

	test("rejects invented points for an unknown dimension and missing points for a known one", async () => {
		fixture = await auditFixture("incomplete");
		const report = fixture.report;
		const unknown = new Set(report.score.unknownDimensions);
		const unknownEntry = report.score.contributions.find((entry) => unknown.has(entry.dimension));
		if (unknownEntry === undefined) throw new Error("expected an unknown contribution");
		const invented = report.score.contributions.map((entry) =>
			entry.dimension === unknownEntry.dimension ? { ...entry, points: 0 } : entry,
		);
		expect(
			auditReportSchema.safeParse({
				...report,
				score: { ...report.score, contributions: invented },
			}).success,
		).toBe(false);
		await fixture.cleanup();
		fixture = await auditFixture("clean");
		const complete = fixture.report;
		const withheld = complete.score.contributions.map((entry, i) =>
			i === 0 ? { ...entry, points: null } : entry,
		);
		expect(
			auditReportSchema.safeParse({
				...complete,
				score: { ...complete.score, contributions: withheld },
			}).success,
		).toBe(false);
	});
});
