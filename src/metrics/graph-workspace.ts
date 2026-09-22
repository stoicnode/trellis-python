/**
 * Workspace-package manifest machinery for import resolution (SPEC §5.4,
 * trellis-d214) — the **pure** half: no filesystem, no resolver state.
 *
 * A bare specifier naming a workspace package resolves through that package's
 * own manifest (documented supported subset):
 *
 * - `exports` — a string (root entry only), or a recursively nested map of
 *   conditions (including a root conditional object without a `"."` key).
 *   The importing file's governing tsconfig `customConditions` take
 *   precedence, followed by `import` → `require` → `default` → `types`.
 *   Keys and targets support a single `*` wildcard (longest literal prefix
 *   wins). Arrays and non-string scalar targets are `unsupported-exports`.
 *   A package **with** an `exports` map
 *   encapsulates: a subpath with no matching entry fails
 *   `exports-encapsulation` — there is no fallback file probe.
 * - Without `exports`: the root resolves via `main`, then `types`, then
 *   `index`; a subpath resolves as a plain file path inside the package.
 *
 * Each candidate string is then resolved like a relative specifier from the
 * package root (see `graph-resolve.ts`), so entry points pointing at absent
 * build outputs surface as documented `unresolved` (`no-target`) edges.
 */

import type { UnresolvedReason } from "./graph-types.ts";

/** Built-in conditions tried after a governing tsconfig's custom conditions. */
const EXPORTS_CONDITIONS = ["import", "require", "default", "types"] as const;

/** Match `value` against a pattern with at most one `*`; returns the matched middle or null. */
export function wildcardMatch(pattern: string, value: string): string | null {
	const star = pattern.indexOf("*");
	if (star === -1 || pattern.indexOf("*", star + 1) !== -1) return null;
	const [prefix, suffix] = [pattern.slice(0, star), pattern.slice(star + 1)];
	if (!value.startsWith(prefix) || !value.endsWith(suffix)) return null;
	return value.slice(prefix.length, value.length - suffix.length);
}

/** The ordered conditions active for one resolution, with duplicate custom conditions removed. */
function activeConditions(customConditions: readonly string[]): string[] {
	return [...new Set([...customConditions, ...EXPORTS_CONDITIONS])];
}

/** Extract one selected target from recursively nested conditional exports. */
function exportsTarget(
	value: unknown,
	conditions: readonly string[],
): { target: string } | { unsupported: true } {
	if (typeof value === "string") return { target: value };
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return { unsupported: true };
	}
	const conditional = value as Record<string, unknown>;
	for (const condition of conditions) {
		const selected = conditional[condition];
		if (selected === undefined) continue;
		const target = exportsTarget(selected, conditions);
		return target;
	}
	return { unsupported: true };
}

/** One exact `exports` entry lookup; unsupported shapes fail explicitly. */
function exactCandidate(
	value: unknown,
	conditions: readonly string[],
): { candidates: string[] } | { failure: UnresolvedReason } {
	const target = exportsTarget(value, conditions);
	return "unsupported" in target
		? { failure: "unsupported-exports" }
		: { candidates: [target.target] };
}

/** Single-`*` wildcard `exports` keys, longest literal prefix wins (documented subset). */
function wildcardCandidate(
	map: Record<string, unknown>,
	key: string,
	conditions: readonly string[],
): { candidates: string[] } | { failure: UnresolvedReason } {
	let best: { prefix: number; middle: string; target: ReturnType<typeof exportsTarget> } | null =
		null;
	for (const [pattern, value] of Object.entries(map)) {
		const middle = wildcardMatch(pattern, key);
		if (middle === null) continue;
		if (best === null || pattern.indexOf("*") > best.prefix) {
			best = { prefix: pattern.indexOf("*"), middle, target: exportsTarget(value, conditions) };
		}
	}
	if (best === null) return { failure: "exports-encapsulation" };
	return "unsupported" in best.target
		? { failure: "unsupported-exports" }
		: { candidates: [best.target.target.replace("*", best.middle)] };
}

/**
 * Manifest `exports` lookup for `subpath` (`""` = the package root); returns
 * candidate target paths or a failure reason (see the module docblock).
 */
export function exportsCandidates(
	exports: unknown,
	subpath: string,
	customConditions: readonly string[] = [],
): { candidates: string[] } | { failure: UnresolvedReason } {
	const key = subpath === "" ? "." : `./${subpath}`;
	if (typeof exports === "string") {
		return key === "." ? { candidates: [exports] } : { failure: "exports-encapsulation" };
	}
	if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
		return { failure: "unsupported-exports" };
	}
	const map = exports as Record<string, unknown>;
	const conditions = activeConditions(customConditions);
	const hasSubpathKeys = Object.keys(map).some((entry) => entry.startsWith("."));
	if (!hasSubpathKeys) {
		return key === "." ? exactCandidate(map, conditions) : { failure: "exports-encapsulation" };
	}
	const exact = map[key];
	return exact !== undefined
		? exactCandidate(exact, conditions)
		: wildcardCandidate(map, key, conditions);
}

/** Manifest fallback candidates when no `exports` map governs (`main`, then `types`, then `index`). */
export function manifestCandidates(manifest: Record<string, unknown>, subpath: string): string[] {
	if (subpath !== "") return [subpath];
	const candidates = [manifest.main, manifest.types].filter(
		(field): field is string => typeof field === "string",
	);
	return candidates.length > 0 ? candidates : ["index"];
}
