import { describe, expect, test } from "bun:test";
import { buildSmellPairs, diffVersions, truncateStudySource } from "./smellbench-pairs.ts";

describe("SmellBench pair preparation", () => {
	test("reconstructs before and after snippets from unified diff hunks", () => {
		const versions = diffVersions(`diff --git a/example.py b/example.py
--- a/example.py
+++ b/example.py
@@ -1,3 +1,3 @@
 keep = 1
-old = 2
+new = 3
 tail = 4`);

		expect(versions.before).toContain("# file: example.py\nkeep = 1\nold = 2\ntail = 4");
		expect(versions.after).toContain("# file: example.py\nkeep = 1\nnew = 3\ntail = 4");
	});

	test("builds opaque ids while preserving the injected direction outside model input", () => {
		const pairs = buildSmellPairs([
			{
				instance_id: "demo-smell-1",
				type: "deeply_inlined_method",
				project_name: "demo",
				smell_content: `diff --git a/a.py b/a.py
--- a/a.py
+++ b/a.py
@@ -1 +1 @@
-result = helper(value)
+result = first(second(third(value)))`,
			},
		]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0]?.good.source).toContain("helper(value)");
		expect(pairs[0]?.bad.source).toContain("first(second(third(value)))");
		expect(pairs[0]?.good.id).not.toContain("good");
		expect(pairs[0]?.bad.id).not.toContain("bad");
	});

	test("bounds model input while retaining both ends of a long source", () => {
		const source = `start\n${"middle\n".repeat(4_000)}end`;
		const result = truncateStudySource(source);

		expect(result.truncated).toBe(true);
		expect(result.source.length).toBeLessThan(16_100);
		expect(result.source.startsWith("start")).toBe(true);
		expect(result.source.endsWith("end")).toBe(true);
	});
});
