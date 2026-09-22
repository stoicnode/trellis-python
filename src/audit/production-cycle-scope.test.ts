import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditWorkspace } from "./audit.ts";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "trellis-production-cycles-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function put(path: string, content: string): Promise<void> {
	const absolute = join(root, path);
	await mkdir(join(absolute, ".."), { recursive: true });
	await writeFile(absolute, content);
}

describe("production-induced cycle scoring", () => {
	for (const language of ["typescript", "python"] as const) {
		test(`keeps the ${language} production score stable under test-only changes`, async () => {
			if (language === "typescript") {
				await put("src/a.ts", 'import "./b";\nexport const a = 1;\n');
				await put("src/b.ts", 'import "./a";\nexport const b = 1;\n');
			} else {
				await put("pkg/__init__.py", "");
				await put("pkg/a.py", "from . import b\na = 1\n");
				await put("pkg/b.py", "from . import a\nb = 1\n");
			}
			const before = await auditWorkspace(root);
			if (language === "typescript") {
				await put("src/a.test.ts", 'import "./b.test";\nexport const a = 1;\n');
				await put("src/b.test.ts", 'import "./a.test";\nexport const b = 1;\n');
				await put("src/broken.test.ts", "export const broken = ;\n");
			} else {
				await put("pkg/test_a.py", "from . import test_b\na = 1\n");
				await put("pkg/test_b.py", "from . import test_a\nb = 1\n");
				await put("pkg/test_broken.py", "def broken(:\n");
			}
			const after = await auditWorkspace(root);
			expect(after.metrics["import-cycle.groups"]?.value).toBeGreaterThan(
				before.metrics["import-cycle.groups"]?.value ?? 0,
			);
			expect(after.metrics["import-cycle.groups.production"]).toEqual(
				before.metrics["import-cycle.groups.production"],
			);
			expect(after.metrics["import-cycle.density.production"]).toEqual(
				before.metrics["import-cycle.density.production"],
			);
			expect(after.score.index).toBe(before.score.index);
			expect(after.score.partial).toBe(false);
			expect(after.completeness).toBe("incomplete");
		});
	}

	test("locates a production import of test code without adding it to the scored graph", async () => {
		await put("src/a.ts", 'import "./a.test";\nexport const a = 1;\n');
		await put("src/a.test.ts", 'import "./a";\nexport const a = 2;\n');
		const report = await auditWorkspace(root);
		expect(report.metrics["import-cycle.groups"]?.value).toBe(1);
		expect(report.metrics["import-cycle.groups.production"]?.value).toBe(0);
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				kind: "graph.production-imports-test",
				path: "src/a.ts",
				facts: expect.objectContaining({ target: "src/a.test.ts" }),
			}),
		);
	});

	test("withholds a score for an unresolved production edge", async () => {
		await put("src/a.ts", 'import "./missing";\nexport const a = 1;\n');
		const report = await auditWorkspace(root);
		expect(report.metrics["import-cycle.groups.production"]?.state).toBe("incomplete");
		expect(report.score.index).toBeNull();
		expect(report.score.unknownDimensions).toContain("import-cycle");
	});

	test("keeps an empty production graph not applicable while test cycles remain visible", async () => {
		await put("src/a.test.ts", 'import "./b.test";\nexport const a = 1;\n');
		await put("src/b.test.ts", 'import "./a.test";\nexport const b = 1;\n');
		const report = await auditWorkspace(root);
		expect(report.metrics["import-cycle.groups"]?.value).toBe(1);
		expect(report.metrics["import-cycle.groups.production"]?.value).toBe(0);
		expect(report.metrics["import-cycle.density.production"]?.state).toBe("not-applicable");
		expect(report.score.index).toBe(0);
	});
});
