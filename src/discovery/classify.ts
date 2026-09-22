/**
 * Source-set classification (SPEC §3.1) — documented defaults plus explicit
 * per-repo overrides from the audit configuration (§6.5).
 *
 * Recognized TypeScript source: `.ts`, `.tsx`, `.mts`, `.cts`. Declaration
 * files (`.d.ts`, `.d.mts`, `.d.cts`) classify `declaration-only` by default.
 * Everything else is unsupported surface (§3.3) — see
 * {@link UNSUPPORTED_SOURCE_EXTENSIONS}.
 *
 * Classification precedence (first match wins):
 * 0. config `source.exclude` — handled by the inventory walk; an excluded
 *    file is never classified at all.
 * 1. config `source.classify` — explicit overrides win over every default;
 *    patterns are evaluated in sorted order so ties are deterministic.
 * 2. `vendored` — any ancestor directory named `vendor` or `third_party`.
 * 3. `generated` — any ancestor directory named `generated` / `__generated__`,
 *    or a basename marker `.gen.` / `.generated.`.
 * 4. `declaration-only` — `*.d.ts` / `*.d.mts` / `*.d.cts`.
 * 5. `test` — basename marker `.test.` / `.spec.`, or any ancestor directory
 *    named `test` / `tests` / `__tests__`.
 * 6. `production` — everything else.
 */
import type { SourceConfig, SourceSet } from "../contract/index.ts";
import { matchGlob } from "./glob.ts";

const TS_SOURCE_RE = /\.(?:ts|tsx|mts|cts)$/;
const PYTHON_SOURCE_RE = /\.py$/;
const DECLARATION_RE = /\.d\.(?:ts|mts|cts)$/;
const TEST_BASENAME_RE = /\.(?:test|spec)\.[^.]+$/;
const PYTHON_TEST_BASENAME_RE = /^(?:test_.*|.*_test)\.py$/;
const GENERATED_BASENAME_RE = /\.(?:gen|generated)\.[^.]+$/;

const VENDORED_DIRS = new Set(["vendor", "third_party"]);
const GENERATED_DIRS = new Set(["generated", "__generated__"]);
const TEST_DIRS = new Set(["test", "tests", "__tests__"]);

/**
 * File extensions counted as **unsupported** source surface (SPEC §3.3): real
 * source in languages trellis does not analyze (including JavaScript).
 * Reported as coverage, never as
 * cleanliness.
 */
export const UNSUPPORTED_SOURCE_EXTENSIONS = [
	".js",
	".mjs",
	".cjs",
	".jsx",
	".pyi",
	".pyx",
	".pxd",
	".swift",
	".go",
	".rs",
	".java",
	".kt",
	".kts",
	".rb",
	".php",
	".c",
	".h",
	".cc",
	".cpp",
	".hpp",
	".cs",
	".scala",
] as const;

/** True when `path` is a TypeScript source file (`.ts`/`.tsx`/`.mts`/`.cts`). */
export function isTypeScriptSource(path: string): boolean {
	return TS_SOURCE_RE.test(path);
}

/** True when `path` is a Python source file. */
export function isPythonSource(path: string): boolean {
	return PYTHON_SOURCE_RE.test(path);
}

/** True when `path` is source supported by the native language adapters. */
export function isSupportedSource(path: string): boolean {
	return isTypeScriptSource(path) || isPythonSource(path);
}

/** True when `path` is an unsupported source file per {@link UNSUPPORTED_SOURCE_EXTENSIONS}. */
export function isUnsupportedSource(path: string): boolean {
	const dot = path.lastIndexOf(".");
	if (dot < 0) return false;
	const ext = path.slice(dot).toLowerCase();
	return (UNSUPPORTED_SOURCE_EXTENSIONS as readonly string[]).includes(ext);
}

/** The outcome of classifying one supported source file. */
export interface Classification {
	/** The assigned source set (SPEC §3.1). */
	sourceSet: SourceSet;
	/** Traceable rule id, e.g. `config:classify:<pattern>` or `default:test`. */
	rule: string;
}

function configuredClassification(path: string, config?: SourceConfig): Classification | undefined {
	const overrides = config?.classify ?? {};
	for (const pattern of Object.keys(overrides).sort()) {
		if (matchGlob(pattern, path)) {
			const set = overrides[pattern] as SourceSet;
			return { sourceSet: set, rule: `config:classify:${pattern}` };
		}
	}
	return undefined;
}

/**
 * Classify one repo-relative supported path into exactly one source set using the
 * precedence documented above. Pure: no filesystem access. Exclusion is NOT
 * checked here — excluded files never reach classification.
 */
export function classifySourceFile(path: string, config?: SourceConfig): Classification {
	const configured = configuredClassification(path, config);
	if (configured !== undefined) return configured;
	const segments = path.split("/");
	const basename = segments[segments.length - 1] ?? path;
	const dirs = segments.slice(0, -1);
	if (dirs.some((segment) => VENDORED_DIRS.has(segment))) {
		return { sourceSet: "vendored", rule: "default:vendored-dir" };
	}
	if (dirs.some((segment) => GENERATED_DIRS.has(segment)) || GENERATED_BASENAME_RE.test(basename)) {
		return { sourceSet: "generated", rule: "default:generated" };
	}
	if (DECLARATION_RE.test(basename)) {
		return { sourceSet: "declaration-only", rule: "default:declaration" };
	}
	if (isTestPath(basename, dirs)) {
		return { sourceSet: "test", rule: "default:test" };
	}
	return { sourceSet: "production", rule: "default:production" };
}

function isTestPath(basename: string, dirs: readonly string[]): boolean {
	return (
		TEST_BASENAME_RE.test(basename) ||
		PYTHON_TEST_BASENAME_RE.test(basename) ||
		dirs.some((segment) => TEST_DIRS.has(segment))
	);
}

/** @deprecated Use {@link classifySourceFile}; retained for existing TypeScript callers. */
export const classifyTsFile = classifySourceFile;
