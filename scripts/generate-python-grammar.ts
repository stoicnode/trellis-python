/** Regenerate the checked-in Python parser without making generation an audit dependency. */
import { readFile, writeFile } from "node:fs/promises";
import { buildParserFile } from "@lezer/generator";

const grammar = "src/python/grammar/trellis-python.grammar";
const parser = "src/python/grammar/trellis-parser.ts";
const terms = "src/python/grammar/trellis-parser.terms.ts";

const source = await readFile(grammar, "utf8");
const generated = buildParserFile(source, { fileName: grammar, typeScript: true });

await writeFile(
	parser,
	"// @ts-nocheck -- generated from trellis-python.grammar; verified through the parser seam.\n" +
		generated.parser,
);
await writeFile(terms, generated.terms);
