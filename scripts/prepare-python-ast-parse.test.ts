import { describe, expect, test } from "bun:test";
import { relative, resolve } from "node:path";
import {
	loadCommittedPythonAstEvidence,
	parsePythonAstEvidence,
	preparePythonAstEvidence,
	pythonAstEvidenceMismatches,
	pythonFiles,
} from "./prepare-python-ast-parse.ts";
import { loadOssBenchmarkManifest } from "./validate-oss-benchmarks.ts";

const ROOT = resolve(import.meta.dir, "../corpus/oss-benchmark");

describe("Python ast preparation evidence", () => {
	test("collects nested Python inputs without reading or executing them", () => {
		const root = resolve(ROOT, "fixtures/parser-recovery");
		expect(
			pythonFiles(root)
				.map((path) => relative(root, path))
				.sort(),
		).toEqual(["src/recovery.py", "src/session.py"]);
	});

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

	test("refuses stale preparation evidence before launching Python or reading a checkout", () => {
		const manifest = loadOssBenchmarkManifest(ROOT);
		const evidence = loadCommittedPythonAstEvidence(ROOT);
		const stale = {
			...evidence,
			entries: evidence.entries.map((entry) =>
				entry.id === "requests" ? { ...entry, revision: "0".repeat(40) } : entry,
			),
		};
		expect(() => preparePythonAstEvidence("/no-prepared-checkout", manifest, stale)).toThrow(
			"evidence revision/tree differs from manifest pin",
		);
	});
});
