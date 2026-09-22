import { describe, expect, test } from "bun:test";
import type { AnalysisResult } from "../contract/index.ts";
import { foldStagedAnalysisOutcome, type StagedRunOutcome } from "./staged-run.ts";

function completeEvidence(): AnalysisResult {
	return {
		provider: {
			kind: "external",
			id: "jscpd",
			toolVersion: "5.2.1",
			adapterVersion: "1.0.0",
			mode: "exact",
			options: {},
		},
		state: "complete",
		analysis: {
			selection: {
				sourceSets: ["production"],
				files: [{ path: "a.ts", fingerprint: "0".repeat(64) }],
			},
			parser: { engine: "jscpd.tokenizer", version: "5.2.1" },
			options: {},
		},
		observedCoverage: { analyzedFiles: ["a.ts"], diagnostics: [], unsupported: [] },
		metrics: [{ id: "provider.jscpd.duplicates", state: "complete", value: 1, unit: "lines" }],
	};
}

describe("foldStagedAnalysisOutcome", () => {
	test("folds every lifecycle outcome into provider-local evidence with cleanup visibility", () => {
		const complete = completeEvidence();
		const boom = new Error("adapter exploded");
		const unavailable = (reason: string): AnalysisResult => ({
			provider: complete.provider,
			state: "unavailable",
			reason,
		});
		const fold = (outcome: StagedRunOutcome<AnalysisResult>): AnalysisResult =>
			foldStagedAnalysisOutcome(outcome, (failure) =>
				unavailable(
					failure.kind === "adapter-failed" && failure.error === boom
						? "adapter failed"
						: failure.kind,
				),
			);

		expect(fold({ kind: "completed", value: complete, cleanup: { status: "cleaned" } })).toEqual(
			complete,
		);
		expect(
			fold({
				kind: "completed",
				value: complete,
				cleanup: { status: "failed", reason: "disk error" },
			}),
		).toMatchObject({
			state: "incomplete",
			reason: "owned scratch cleanup failed: disk error",
			metrics: complete.metrics,
			observedCoverage: {
				analyzedFiles: ["a.ts"],
				diagnostics: [{ message: "owned scratch cleanup failed: disk error" }],
			},
		});
		expect(
			fold({
				kind: "completed",
				value: { ...complete, state: "incomplete", reason: "partial coverage" },
				cleanup: { status: "failed", reason: "disk error" },
			}),
		).toMatchObject({
			state: "incomplete",
			reason: "partial coverage; owned scratch cleanup failed: disk error",
			metrics: complete.metrics,
		});
		expect(
			fold({ kind: "adapter-failed", error: boom, cleanup: { status: "cleaned" } }),
		).toMatchObject({
			state: "unavailable",
			reason: "adapter failed",
		});
		expect(fold({ kind: "cancelled", cleanup: { status: "cleaned" } })).toMatchObject({
			state: "unavailable",
			reason: "cancelled",
		});
		expect(fold({ kind: "timeout", cleanup: { status: "cleaned" } })).toMatchObject({
			state: "unavailable",
			reason: "timeout",
		});
	});
});
