import { readdir } from "node:fs/promises";
import { join, posix } from "node:path";

export const SUITES = ["unit", "app", "codex", "pandoc"] as const;
export type Suite = (typeof SUITES)[number];
export type SuiteFiles = Record<Suite, string[]>;

export const TEST_ROOT = "test";
export const INPUT_IGNORE_PATTERNS = ["**/fixtures/**"] as const;
export const UNIT_IGNORE_PATTERNS = [
  ...SUITES.filter((suite) => suite !== "unit").map((suite) => `**/*.${suite}.test.ts`),
  ...INPUT_IGNORE_PATTERNS,
];

/** Bun's discovery forms; suite policy further requires .<suite>.test.ts. */
export function isBunTestFile(path: string): boolean {
  return /[._](?:test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/.test(path);
}

function canonicalPath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    posix.isAbsolute(normalized) ||
    /^[a-z]:/i.test(normalized) ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Expected a repository-relative test path: ${path}`);
  }
  return normalized;
}

export function isTestInput(path: string): boolean {
  return canonicalPath(path).split("/").slice(0, -1).includes("fixtures");
}

/** Read filenames only. Hidden directories and node_modules follow Bun discovery. */
export async function inventoryTestFiles(root: string): Promise<string[]> {
  const paths: string[] = [];
  async function visit(relative: string): Promise<void> {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory() && (entry.name.startsWith(".") || entry.name === "node_modules"))
        continue;
      if (entry.isSymbolicLink()) {
        if (isBunTestFile(path) || path === TEST_ROOT || path.startsWith(`${TEST_ROOT}/`)) {
          throw new Error(`Test discovery does not follow symbolic links: ${path}`);
        }
      } else if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && isBunTestFile(path)) {
        paths.push(path);
      }
    }
  }
  await visit("");
  return paths.sort();
}

export function classifyTestFiles(paths: readonly string[]): {
  suites: SuiteFiles;
  inputs: string[];
} {
  const suites: SuiteFiles = { unit: [], app: [], codex: [], pandoc: [] };
  const inputs: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const path = canonicalPath(raw);
    if (seen.has(path)) throw new Error(`Duplicate test ownership: ${path}`);
    seen.add(path);
    if (!isBunTestFile(path)) throw new Error(`Not a Bun test filename: ${path}`);
    if (isTestInput(path)) {
      inputs.push(path);
      continue;
    }
    if (!path.startsWith(`${TEST_ROOT}/`)) throw new Error(`Test outside ${TEST_ROOT}/: ${path}`);
    const suite = SUITES.find((candidate) => path.endsWith(`.${candidate}.test.ts`));
    if (!suite) throw new Error(`Missing or unknown suite suffix: ${path}`);
    suites[suite].push(path);
  }
  for (const suite of SUITES) suites[suite].sort();
  return { suites, inputs: inputs.sort() };
}

export async function discoverSuites(root: string): Promise<ReturnType<typeof classifyTestFiles>> {
  return classifyTestFiles(await inventoryTestFiles(root));
}

export function selectTestFiles(suites: SuiteFiles, requested: readonly Suite[]): string[] {
  if (!requested.length) throw new Error("Select at least one suite.");
  const files: string[] = [];
  const seen = new Set<Suite>();
  for (const suite of requested) {
    if (!SUITES.includes(suite)) throw new Error(`Unknown suite: ${suite}`);
    if (seen.has(suite)) throw new Error(`Duplicate suite selection: ${suite}`);
    seen.add(suite);
    if (!suites[suite].length) throw new Error(`Suite has no tests: ${suite}`);
    for (const path of suites[suite]) {
      if (!path.endsWith(`.${suite}.test.ts`)) {
        throw new Error(`Test does not belong to ${suite}: ${path}`);
      }
      files.push(path);
    }
  }
  // Recheck caller-supplied memberships rather than silently deduplicating them.
  const classified = classifyTestFiles(files);
  if (classified.inputs.length) throw new Error("Selected tests include excluded fixture inputs.");
  return files.map(canonicalPath).sort();
}

/** Exact files plus a replacement ignore list; an empty selection must never reach Bun. */
export function exactTestArguments(files: readonly string[]): string[] {
  if (!files.length) throw new Error("Cannot launch an empty test selection.");
  const classified = classifyTestFiles(files);
  if (classified.inputs.length) throw new Error("Selected tests include excluded fixture inputs.");
  return [
    "test",
    ...files
      .map(canonicalPath)
      .sort()
      .map((path) => `./${path}`),
    ...INPUT_IGNORE_PATTERNS.flatMap((pattern) => ["--path-ignore-patterns", pattern]),
  ];
}

/** Accept parsed TOML so this contract stays independent of the parsing runtime. */
export function assertUnitDiscoveryConfig(config: unknown): void {
  const test = (config as { test?: { root?: unknown; pathIgnorePatterns?: unknown } } | null)?.test;
  if (test?.root !== TEST_ROOT && test?.root !== `./${TEST_ROOT}`) {
    throw new Error("Test discovery root must be ./test.");
  }
  const patterns = test.pathIgnorePatterns;
  if (
    !Array.isArray(patterns) ||
    patterns.some((pattern) => typeof pattern !== "string") ||
    [...patterns].sort().join("\n") !== [...UNIT_IGNORE_PATTERNS].sort().join("\n")
  ) {
    throw new Error("Test ignore patterns disagree with suite selection.");
  }
}
