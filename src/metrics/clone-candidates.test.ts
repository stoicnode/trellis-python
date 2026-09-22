import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "../audit/index.ts";
import { selectIndependentCloneIntervals } from "./clone-candidates.ts";
import { measureCandidateScope } from "./duplication-candidate.ts";
import type { CloneTokenInterval } from "./duplication-finalize.ts";
import { repeatedSource, sourceFile } from "./tests/duplication-fixtures.ts";

function interval(path: string, startToken: number, endToken: number): CloneTokenInterval {
	return { path, startToken, endToken, startLine: 2, endLine: 4 };
}

describe("independent clone candidates", () => {
	test("counts disjoint same-line token intervals without accepting self-shift overlap", () => {
		const selected = selectIndependentCloneIntervals([
			interval("a.ts", 1, 101),
			interval("a.ts", 0, 100),
			interval("a.ts", 100, 200),
			interval("a.ts", 101, 201),
			interval("b.ts", 0, 100),
		]);
		expect(selected).toEqual([
			interval("a.ts", 0, 100),
			interval("a.ts", 100, 200),
			interval("b.ts", 0, 100),
		]);
	});

	test("retains two, ten and forty renamed executable copies as separate advisory burden", () => {
		for (const count of [2, 10, 40]) {
			const result = measureCandidateScope(
				Array.from({ length: count }, (_, index) =>
					sourceFile(`f${index}.ts`, repeatedSource(`fn${index}`)),
				),
			);
			expect(result.exhaustion).toBeNull();
			expect(result.groups).toHaveLength(1);
			expect(result.candidate).toMatchObject({
				executableGroups: 1,
				kindPreservingGroups: 1,
				equalityPreservingGroups: 1,
				statementAlignedGroups: 1,
				independentCopies: count - 1,
				eligibleLines: count * 27,
				coveredLines: count * 27,
				density: 1,
			});
		}
	});

	test("keeps independent copies that share a boundary line", () => {
		const source = `${repeatedSource("first").trimEnd()} ${repeatedSource("second")}`;
		const result = measureCandidateScope([sourceFile("one.ts", source)]);
		expect(result.groups).toHaveLength(1);
		expect(result.groups[0]?.members[0]?.range.end.line).toBe(
			result.groups[0]?.members[1]?.range.start.line,
		);
		expect(result.candidate?.groups[0]).toMatchObject({
			independentOccurrences: 2,
			independentExecutableOccurrences: 2,
			independentMemberIndexes: [0, 1],
			eligible: true,
		});
	});

	test("preserves a long export-list self-shift without asserting an independent code copy", () => {
		const names = Array.from({ length: 200 }, (_, index) => `name${index}`);
		const source = `export {\n${names.join(",\n")}\n} from "./module";\n`;
		const result = measureCandidateScope([sourceFile("exports.ts", source)]);
		expect(result.exhaustion).toBeNull();
		expect(result.groups.length).toBeGreaterThan(0);
		expect(result.candidate?.groups).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					context: "import-export-list",
					independentOccurrences: 1,
					eligible: false,
				}),
			]),
		);
		expect(result.candidate?.executableGroups).toBe(0);
	});

	test("distinguishes identical data copies from similar table shapes", () => {
		const table = `const palette = {\n${Array.from({ length: 80 }, (_, index) => `  k${index}: "c${index}",`).join("\n")}\n};`;
		const result = measureCandidateScope([sourceFile("a.ts", table), sourceFile("b.ts", table)]);
		expect(result.groups.length).toBeGreaterThan(0);
		expect(result.candidate?.exactDataGroups).toBeGreaterThan(0);
		expect(result.candidate?.executableGroups).toBe(0);
	});

	test("compares literal kinds and identifier/literal equality without changing raw matches", () => {
		const original = repeatedSource("first");
		const changedValues = repeatedSource("second").replace(
			/return (\d+);/g,
			(_, value: string) => `return ${100 + Number(value)};`,
		);
		const changedKinds = repeatedSource("second").replace(/\b(\d+)\b/g, '"$1"');
		const equality = measureCandidateScope([
			sourceFile("a.ts", original),
			sourceFile("b.ts", changedValues),
		]);
		const kinds = measureCandidateScope([
			sourceFile("a.ts", original),
			sourceFile("b.ts", changedKinds),
		]);
		expect(equality.groups).toHaveLength(1);
		expect(kinds.groups).toHaveLength(1);
		expect(equality.candidate?.groups[0]).toMatchObject({
			kindPreserving: true,
			equalityPreserving: false,
		});
		expect(kinds.candidate?.groups[0]).toMatchObject({
			kindPreserving: false,
			equalityPreserving: true,
		});
	});

	test("marks balanced data and executable spans as mixed context", () => {
		const mixed = (name: string) =>
			`export function ${name}(x: number) {\nconst palette = {\n${Array.from({ length: 20 }, (_, index) => `k${index}: "c${index}",`).join("\n")}\n};\n${Array.from({ length: 8 }, (_, index) => `if (x === ${index}) return palette.k${index};`).join("\n")}\nreturn x;\n}`;
		const result = measureCandidateScope([
			sourceFile("a.ts", mixed("one")),
			sourceFile("b.ts", mixed("two")),
		]);
		expect(result.groups).toHaveLength(1);
		expect(result.candidate?.groups[0]).toMatchObject({
			context: "mixed-unknown",
			independentOccurrences: 2,
			eligible: false,
		});
	});

	test("classifies distinct table shapes as literal data while retaining raw detections", () => {
		const table = (name: string) =>
			`export const ${name} = {\n${Array.from({ length: 80 }, (_, index) => `  k${index}: "${name}${index}",`).join("\n")}\n};`;
		const result = measureCandidateScope([
			sourceFile("emoji.ts", table("emoji")),
			sourceFile("color.ts", table("color")),
		]);
		expect(result.exhaustion).toBeNull();
		expect(result.groups.length).toBeGreaterThan(0);
		expect(result.candidate?.groups[0]).toMatchObject({
			context: "literal-data",
			independentOccurrences: 2,
			independentExecutableOccurrences: 0,
			eligible: false,
		});
		expect(result.candidate?.executableGroups).toBe(0);
	});

	test("keeps copied Python package initialization and dictionary-building logic visible", async () => {
		const root = await mkdtemp(join(tmpdir(), "trellis-clone-candidate-"));
		try {
			const body = (name: string) =>
				`def ${name}(items):\n    result = {}\n    for item in items:\n${Array.from({ length: 24 }, (_, index) => `        result[str(item) + "k${index}"] = item + ${index}`).join("\n")}\n    return result\n`;
			for (const [folder, name] of [
				["a", "first"],
				["b", "second"],
			] as const) {
				await mkdir(join(root, folder));
				await writeFile(join(root, folder, "__init__.py"), body(name));
			}
			const report = await auditWorkspace(root);
			expect(report.metrics["duplication.groups.production"]?.value).toBeGreaterThan(0);
			expect(
				report.metrics["duplication.candidate.executable-groups.production"]?.value,
			).toBeGreaterThan(0);
			expect(
				report.metrics["duplication.candidate.independent-copies.production"]?.value,
			).toBeGreaterThan(0);
			const density = report.metrics["duplication.candidate.density.production"];
			expect(density?.numerator).toBe(
				report.metrics["duplication.candidate.covered-lines.production"]?.value,
			);
			expect(density?.denominator).toBe(
				report.metrics["duplication.candidate.eligible-lines.production"]?.value,
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
