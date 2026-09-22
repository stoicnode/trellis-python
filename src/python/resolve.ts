/** Conservative, filesystem-free resolution of Python imports against the discovered inventory. */
import { dirname } from "node:path";
import type { SourceInventory } from "../discovery/index.ts";
import type { GraphResolver } from "../metrics/graph-resolve.ts";
import type { EdgeResolution, GraphConfig } from "../metrics/graph-types.ts";
import type { ImportSite } from "../syntax/import-sites.ts";

interface ModuleEntry {
	path: string;
	module: string;
	base: string;
	isPackage: boolean;
}

interface ModuleIndex {
	byModule: ReadonlyMap<string, readonly ModuleEntry[]>;
	byPath: ReadonlyMap<string, readonly ModuleEntry[]>;
}

function parentDirectories(path: string): string[] {
	const directories: string[] = [];
	let current = dirname(path).replace(/\\/g, "/");
	for (;;) {
		directories.push(current === "." ? "" : current);
		if (current === "." || current === "") return directories;
		current = dirname(current).replace(/\\/g, "/");
	}
}

/** Root/package bases and every `src` directory give the documented import layouts. */
function basesFor(path: string, packagePath: string): string[] {
	const bases = new Set([packagePath === "." ? "" : packagePath]);
	for (const directory of parentDirectories(path)) {
		if (directory === "src" || directory.endsWith("/src")) bases.add(directory);
	}
	return [...bases];
}

function moduleFor(path: string, base: string): Omit<ModuleEntry, "path" | "base"> | null {
	const prefix = base === "" ? "" : `${base}/`;
	if (!path.startsWith(prefix) || !path.endsWith(".py")) return null;
	const relative = path.slice(prefix.length, -3);
	const isPackage = relative === "__init__" || relative.endsWith("/__init__");
	const withoutInit = isPackage ? relative.replace(/(?:^|\/)__init__$/, "") : relative;
	return { module: withoutInit.replaceAll("/", "."), isPackage };
}

function addEntry(map: Map<string, ModuleEntry[]>, key: string, entry: ModuleEntry): void {
	const entries = map.get(key) ?? [];
	if (!entries.some((existing) => existing.path === entry.path && existing.base === entry.base)) {
		entries.push(entry);
		map.set(key, entries);
	}
}

function buildModuleIndex(source: SourceInventory): ModuleIndex {
	const byModule = new Map<string, ModuleEntry[]>();
	const byPath = new Map<string, ModuleEntry[]>();
	for (const file of source.files) {
		if (file.language !== "python") continue;
		for (const base of basesFor(file.path, file.packagePath)) {
			const module = moduleFor(file.path, base);
			if (module === null) continue;
			const entry: ModuleEntry = { path: file.path, base, ...module };
			addEntry(byModule, entry.module, entry);
			addEntry(byPath, entry.path, entry);
		}
	}
	return { byModule, byPath };
}

function packageName(specifier: string): string {
	return specifier.split(".")[0] ?? specifier;
}

function unresolved(reason: "no-target" | "ambiguous", detail: string): EdgeResolution {
	return { status: "unresolved", reason, detail };
}

function resolveEntries(
	entries: readonly ModuleEntry[] | undefined,
	module: string,
): EdgeResolution | null {
	if (entries === undefined || entries.length === 0) return null;
	const paths = [...new Set(entries.map((entry) => entry.path))];
	if (paths.length === 1) return { status: "local", target: paths[0] ?? "" };
	return unresolved(
		"ambiguous",
		`Python module '${module}' has multiple discovered source-root owners`,
	);
}

function localTargets(resolutions: readonly EdgeResolution[]): string[] {
	return [
		...new Set(
			resolutions.flatMap((resolution) =>
				resolution.status === "local" ? [resolution.target] : [],
			),
		),
	];
}

function knownPrefix(index: ModuleIndex, module: string): boolean {
	const parts = module.split(".");
	for (let length = parts.length; length > 0; length -= 1) {
		if (index.byModule.has(parts.slice(0, length).join("."))) return true;
	}
	return false;
}

function resolveAbsolute(index: ModuleIndex, module: string): EdgeResolution {
	const exact = resolveEntries(index.byModule.get(module), module);
	if (exact !== null) return exact;
	if (knownPrefix(index, module)) {
		return unresolved("no-target", `local Python module '${module}' has no discovered target`);
	}
	return { status: "external", packageName: packageName(module) };
}

function relativeModules(
	index: ModuleIndex,
	fromPath: string,
	level: number,
	module: string,
): string[] {
	const entries = index.byPath.get(fromPath) ?? [];
	const candidates = new Set<string>();
	for (const entry of entries) {
		const owner = entry.isPackage ? entry.module : entry.module.split(".").slice(0, -1).join(".");
		const parts = owner === "" ? [] : owner.split(".");
		const up = level - 1;
		if (up > parts.length) continue;
		const prefix = parts.slice(0, parts.length - up);
		const suffix = module === "" ? [] : module.split(".");
		candidates.add([...prefix, ...suffix].join("."));
	}
	return [...candidates];
}

function resolveRelative(
	index: ModuleIndex,
	fromPath: string,
	level: number,
	module: string,
): EdgeResolution {
	const candidates = relativeModules(index, fromPath, level, module);
	if (candidates.length === 0) {
		return unresolved("no-target", "relative Python import escapes its discovered package context");
	}
	const resolutions = candidates.map((candidate) =>
		resolveEntries(index.byModule.get(candidate), candidate),
	);
	const local = resolutions.filter(
		(resolution): resolution is EdgeResolution => resolution !== null,
	);
	const targets = localTargets(local);
	if (local.some((resolution) => resolution.status === "unresolved"))
		return unresolved("ambiguous", "relative import has multiple source-root interpretations");
	if (targets.length === 1) return { status: "local", target: targets[0] ?? "" };
	if (targets.length > 1)
		return unresolved("ambiguous", "relative import has multiple source-root interpretations");
	return unresolved(
		"no-target",
		`relative Python module '${module || "."}' has no discovered target`,
	);
}

function childModule(module: string, imported: readonly string[]): string | null {
	if (imported.length !== 1 || imported[0] === "*") return null;
	const child = imported[0];
	return child === undefined ? null : module === "" ? child : `${module}.${child}`;
}

function resolveFrom(
	index: ModuleIndex,
	fromPath: string,
	site: NonNullable<ImportSite["python"]>,
): EdgeResolution {
	const module = site.module ?? "";
	const candidates =
		site.level === 0 ? [module] : relativeModules(index, fromPath, site.level, module);
	if (candidates.length === 0) {
		return unresolved("no-target", "relative Python import escapes its discovered package context");
	}
	const childCandidates = candidates.flatMap((candidate) => {
		const child = childModule(candidate, site.imported);
		return child === null ? [] : [child];
	});
	const children = childCandidates
		.map((candidate) => resolveEntries(index.byModule.get(candidate), candidate))
		.filter((resolution): resolution is EdgeResolution => resolution !== null);
	const childTargets = localTargets(children);
	if (children.some((resolution) => resolution.status === "unresolved"))
		return unresolved("ambiguous", "Python import child has multiple source-root owners");
	if (childTargets.length === 1) return { status: "local", target: childTargets[0] ?? "" };
	if (childTargets.length > 1)
		return unresolved("ambiguous", "Python import child has multiple source-root owners");
	if (site.level > 0) return resolveRelative(index, fromPath, site.level, module);
	return resolveAbsolute(index, module);
}

/**
 * Create a resolver for Python sites. It indexes only discovered `.py` files,
 * never imports modules, probes environments, or reads interpreter configuration.
 */
export function createPythonGraphResolver(source: SourceInventory): GraphResolver {
	const index = buildModuleIndex(source);
	return {
		resolve(fromPath, site): EdgeResolution {
			if (site.specifier === null || site.python?.form === "dynamic") {
				return {
					status: "unresolved",
					reason: "non-literal-dynamic",
					detail: "Python dynamic imports are a static-analysis limitation",
				};
			}
			const python = site.python;
			if (python === undefined)
				return { status: "external", packageName: packageName(site.specifier) };
			if (python.form === "from") return resolveFrom(index, fromPath, python);
			return resolveAbsolute(index, python.module ?? site.specifier);
		},
		configs: (): GraphConfig[] => [],
	};
}
