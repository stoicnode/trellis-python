import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildParserFile } from "@lezer/generator";

const REPO_ROOT = resolve(import.meta.dir, "..");
const GRAMMAR = "src/python/grammar/trellis-python.grammar";
const PARSER = "src/python/grammar/trellis-parser.ts";
const TERMS = "src/python/grammar/trellis-parser.terms.ts";
const GENERATED_HEADER =
	"// @ts-nocheck -- generated from trellis-python.grammar; verified through the parser seam.\n";

describe("checked-in Python grammar artifacts", () => {
	test("match the pinned generator output", async () => {
		const source = await readFile(resolve(REPO_ROOT, GRAMMAR), "utf8");
		const generated = buildParserFile(source, { fileName: GRAMMAR, typeScript: true });
		const [parser, terms] = await Promise.all([
			readFile(resolve(REPO_ROOT, PARSER), "utf8"),
			readFile(resolve(REPO_ROOT, TERMS), "utf8"),
		]);

		expect(parser).toBe(GENERATED_HEADER + generated.parser);
		expect(terms).toBe(generated.terms);
	});
});
