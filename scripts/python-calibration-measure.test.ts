import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collect, rssToMb } from "./python-calibration-measure.ts";

describe("rssToMb", () => {
	test("converts Darwin byte counts and Linux KiB counts to MiB", () => {
		expect(rssToMb(128 * 1024 * 1024, "darwin")).toBe(128);
		expect(rssToMb(128 * 1024, "linux")).toBe(128);
	});
});

describe("Python calibration measurement", () => {
	test("repeats a pinned clean checkout and rejects a dirty or mismatched pin", () => {
		const preparedRoot = mkdtempSync(join(tmpdir(), "trellis-calibration-"));
		const repo = join(preparedRoot, "sample");
		mkdirSync(join(repo, "package"), { recursive: true });
		const git = (...args: string[]) =>
			execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
		try {
			git("init", "-q");
			git("config", "user.name", "Calibration Test");
			git("config", "user.email", "calibration@example.invalid");
			writeFileSync(join(repo, "package", "module.py"), "def value():\n    return 1\n");
			git("add", "package/module.py");
			git("commit", "-qm", "fixture");
			const input = join(preparedRoot, "manifest.json");
			const manifest = (commit: string) => ({
				version: 1,
				repositories: [
					{
						id: "sample",
						commit,
						tree: git("rev-parse", "HEAD^{tree}"),
						scopes: [{ id: "package", path: "package" }],
					},
				],
			});
			writeFileSync(input, JSON.stringify(manifest(git("rev-parse", "HEAD"))));
			const result = collect(input, preparedRoot, 2);
			expect(result.ok).toBe(true);
			expect(result.scopes[0]?.deterministic).toBe(true);
			writeFileSync(input, JSON.stringify(manifest("0".repeat(40))));
			expect(() => collect(input, preparedRoot, 1)).toThrow("not the pinned clean checkout");
			writeFileSync(input, JSON.stringify(manifest(git("rev-parse", "HEAD"))));
			writeFileSync(join(repo, "package", "module.py"), "def value():\n    return 2\n");
			expect(() => collect(input, preparedRoot, 1)).toThrow("not the pinned clean checkout");
		} finally {
			rmSync(preparedRoot, { recursive: true, force: true });
		}
	});
});
