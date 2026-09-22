/** Physical documentation content counts, without string evaluation. */

export interface ContentCounts {
	contentLines: number;
	words: number;
}

function count(text: string): ContentCounts {
	const lines = text.split(/\r\n|\n|\r/u).filter((line) => line.trim().length > 0);
	return { contentLines: lines.length, words: text.match(/\S+/gu)?.length ?? 0 };
}

/** Remove the physical prefix and quote delimiters of one Python literal. */
function pythonLiteralContent(raw: string): string {
	const prefix = /^[rRuU]/u.test(raw) ? 1 : 0;
	const quote = raw[prefix];
	if (quote !== "'" && quote !== '"') return "";
	const width = raw.slice(prefix, prefix + 3) === quote.repeat(3) ? 3 : 1;
	return raw.slice(prefix + width, -width);
}

/** Adjacent physical literal pieces are counted without decoding escapes. */
export function pythonContentCounts(parts: readonly string[]): ContentCounts {
	return count(parts.map(pythonLiteralContent).join("\n"));
}

/** Strip JSDoc delimiters and the leading star marker on each physical line. */
export function jsDocContentCounts(raw: string): ContentCounts {
	const body = raw.slice(3, -2);
	return count(
		body
			.split(/\r\n|\n|\r/u)
			.map((line) => line.replace(/^\s*\* ?/u, ""))
			.join("\n"),
	);
}
