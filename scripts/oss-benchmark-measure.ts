#!/usr/bin/env bun
import { createHash } from "node:crypto";
/** Fresh-process measurements for the read-only OSS benchmark harness. */
import { resolve } from "node:path";
import { runWorkspaceAudit } from "../src/audit/index.ts";
import { measurementPayload } from "../src/contract/index.ts";
import { DEFAULT_DUPLICATION_BUDGET } from "../src/metrics/index.ts";
import { pinnedFindingEvidence } from "./oss-benchmark-acceptance.ts";
import {
	equalReasonCounts,
	type FixtureRecord,
	fixtureSnapshot,
	loadOssBenchmarkManifest,
	type OssBenchmarkFixture,
	peakRssMb,
	pythonDiagnostics,
	unresolvedReasons,
} from "./validate-oss-benchmarks.ts";

async function measureFixture(root: string, fixture: OssBenchmarkFixture): Promise<FixtureRecord> {
	const fixtureRoot = resolve(root, fixture.path);
	const actual = await fixtureSnapshot(fixtureRoot);
	const startedAt = performance.now();
	const result = await runWorkspaceAudit(fixtureRoot, {
		now: new Date("2026-09-22T00:00:00.000Z"),
		...(fixture.maxMatchWork === undefined
			? {}
			: {
					duplicationBudget: { ...DEFAULT_DUPLICATION_BUDGET, maxMatchWork: fixture.maxMatchWork },
				}),
	});
	return {
		id: fixture.id,
		snapshot: { expected: fixture.snapshot, actual, matches: fixture.snapshot === actual },
		completeness: result.report.completeness,
		sourceCoverage: result.report.sourceCoverage,
		metrics: Object.fromEntries(
			Object.values(result.report.metrics).map((metric) => [
				metric.id,
				{
					state: metric.state,
					value: metric.value ?? null,
					...(metric.reason === undefined ? {} : { reason: metric.reason }),
				},
			]),
		),
		scoreContributions: result.report.score.contributions,
		unresolvedReasons: unresolvedReasons(result.report),
		diagnostics: await pythonDiagnostics(fixtureRoot),
		measurement: { durationMs: performance.now() - startedAt, peakRssMb: peakRssMb() },
	};
}

async function measurePinned(root: string, externalRoot: string, id: string): Promise<unknown> {
	const baseline = loadOssBenchmarkManifest(root).baselines.find((entry) => entry.id === id);
	if (baseline === undefined) throw new Error(`unknown pinned baseline: ${id}`);
	const startedAt = performance.now();
	const report = (
		await runWorkspaceAudit(
			resolve(externalRoot, baseline.repository ?? baseline.id, baseline.path ?? "."),
			{
				now: new Date("2026-09-22T00:00:00.000Z"),
			},
		)
	).report;
	const observed = {
		index: report.score.index,
		completeness: report.completeness,
		files: report.sourceCoverage.production.files,
		sloc: report.sourceCoverage.production.sloc,
		parseFailures: (report.languageCoverage ?? []).reduce(
			(sum, row) => sum + row.parseFailureFiles,
			0,
		),
		reasons: unresolvedReasons(report),
	};
	const matches =
		observed.index === baseline.index &&
		observed.completeness === baseline.completeness &&
		observed.files === baseline.production.files &&
		observed.sloc === baseline.production.sloc &&
		observed.parseFailures === baseline.parseFailures &&
		equalReasonCounts(observed.reasons, baseline.unresolvedReasons);
	return {
		...(matches
			? {}
			: { mismatch: `${baseline.id}: re-audit revision mismatch ${JSON.stringify(observed)}` }),
		record: {
			id: baseline.id,
			matches,
			observed,
			sourceCoverage: report.sourceCoverage,
			metrics: Object.fromEntries(
				Object.values(report.metrics).map((metric) => [
					metric.id,
					{ state: metric.state, reason: metric.reason },
				]),
			),
			scoreContributions: report.score.contributions,
			measurement: { durationMs: performance.now() - startedAt, peakRssMb: peakRssMb() },
		},
	};
}

/** Measure one pinned scope without comparing it to the frozen historical baseline. */
async function measurePinnedAcceptance(
	root: string,
	externalRoot: string,
	id: string,
): Promise<unknown> {
	const baseline = loadOssBenchmarkManifest(root).baselines.find((entry) => entry.id === id);
	if (baseline === undefined) throw new Error(`unknown pinned acceptance scope: ${id}`);
	const startedAt = performance.now();
	const report = (
		await runWorkspaceAudit(
			resolve(externalRoot, baseline.repository ?? baseline.id, baseline.path ?? "."),
			{ now: new Date("2026-09-22T00:00:00.000Z") },
		)
	).report;
	const payloadFingerprint = createHash("sha256")
		.update(JSON.stringify(measurementPayload(report)))
		.digest("hex");
	const ranked = report.findings.filter(
		(finding) =>
			finding.kind === "complexity.hotspot" ||
			finding.kind === "duplication.clone-group" ||
			finding.kind === "import-cycle",
	);
	return {
		id,
		payloadFingerprint,
		summary: {
			completeness: report.completeness,
			score: report.score,
			sourceCoverage: report.sourceCoverage,
			parseFailures: (report.languageCoverage ?? []).reduce(
				(sum, row) => sum + row.parseFailureFiles,
				0,
			),
			unresolvedReasons: unresolvedReasons(report),
			incompleteMetrics: Object.values(report.metrics)
				.filter((metric) => metric.state === "incomplete")
				.map((metric) => metric.id),
			hotspots: ranked.slice(0, 10).map(pinnedFindingEvidence),
			cloneGroups: report.findings
				.filter((finding) => finding.kind === "duplication.clone-group")
				.slice(0, 10)
				.map(pinnedFindingEvidence),
		},
		measurement: { durationMs: performance.now() - startedAt, peakRssMb: peakRssMb() },
	};
}

if (import.meta.main) {
	const [mode, root, externalRoot, id] = process.argv.slice(2);
	if (mode === "fixture" && root !== undefined && externalRoot !== undefined) {
		const fixture = loadOssBenchmarkManifest(root).fixtures.find(
			(entry) => entry.id === externalRoot,
		);
		if (fixture === undefined) throw new Error(`unknown fixture: ${externalRoot}`);
		measureFixture(root, fixture).then((record) => console.log(JSON.stringify(record)));
	} else if (
		mode === "pinned" &&
		root !== undefined &&
		externalRoot !== undefined &&
		id !== undefined
	) {
		measurePinned(root, externalRoot, id).then((record) => console.log(JSON.stringify(record)));
	} else if (
		mode === "acceptance" &&
		root !== undefined &&
		externalRoot !== undefined &&
		id !== undefined
	) {
		measurePinnedAcceptance(root, externalRoot, id).then((record) =>
			console.log(JSON.stringify(record)),
		);
	} else {
		throw new Error(
			"usage: oss-benchmark-measure.ts fixture <root> <id> | pinned|acceptance <root> <repos> <id>",
		);
	}
}
