import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	loadCommittedPythonAstEvidence,
	parsePythonAstEvidence,
	pythonAstEvidenceMismatches,
} from "./prepare-python-ast-parse.ts";
import { loadOssBenchmarkManifest } from "./validate-oss-benchmarks.ts";

const ROOT = resolve(import.meta.dir, "../corpus/oss-benchmark");

describe("Python ast preparation evidence", () => {
	test("maps committed evidence to the manifest's pinned Python repositories", () => {
		const manifest = loadOssBenchmarkManifest(ROOT);
		const evidence = loadCommittedPythonAstEvidence(ROOT);
		expect(pythonAstEvidenceMismatches(manifest, evidence)).toEqual([]);
		expect(evidence.entries.map((entry) => [entry.id, entry.files])).toEqual([
			["requests", 37],
			["flask", 83],
			["rich", 213],
		]);
	});

	test("rejects an unpinned artifact shape before any prepared checkout is read", () => {
		expect(() =>
			parsePythonAstEvidence({
				purpose: "test",
				interpreter: "python3",
				entries: [{ id: "requests", revision: "not-a-sha", files: 37, astParseFailures: [] }],
			}),
		).toThrow();
	});

	test("rejects a subset even when every retained entry is pinned", () => {
		const manifest = loadOssBenchmarkManifest(ROOT);
		const evidence = loadCommittedPythonAstEvidence(ROOT);
		expect(
			pythonAstEvidenceMismatches(manifest, { ...evidence, entries: evidence.entries.slice(1) }),
		).toContain("evidence must contain exactly flask, requests, and rich");
	});
});
