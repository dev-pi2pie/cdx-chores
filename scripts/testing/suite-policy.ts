import type { ProcessLimits } from "./process.ts";
import type { Suite } from "./selection.ts";

export interface SuitePolicy {
  readonly prerequisites: readonly string[];
  readonly versionKeys: readonly string[];
  readonly preflight: Readonly<ProcessLimits>;
  readonly execution: Readonly<ProcessLimits>;
}

const limits = (timeoutMs: number): Readonly<ProcessLimits> =>
  Object.freeze({ timeoutMs, graceMs: 1000, cleanupMs: 4000 });
const common = ["Bun", "macOS process observation (/bin/ps)"];

/**
 * Wall-clock limits include native work. App's 240 seconds provides headroom over
 * the Phase 2 full selection (~120 seconds). Every leaf runs once, without retry.
 * The common grace and cleanup budgets bound descendants and stream shutdown.
 */
export const SUITE_POLICIES: Readonly<Record<Suite, SuitePolicy>> = Object.freeze({
  unit: Object.freeze({
    prerequisites: Object.freeze([...common]),
    versionKeys: Object.freeze(["bun"]),
    preflight: limits(10_000),
    execution: limits(30_000),
  }),
  app: Object.freeze({
    prerequisites: Object.freeze([
      ...common,
      "Node.js with node:sqlite",
      "bash, git, zip, unzip, jq and macOS shell utilities",
      "DuckDB under Bun and Node.js",
      "Current DuckDB excel and sqlite_scanner extension cache",
      "PDF.js package",
    ]),
    versionKeys: Object.freeze([
      "bun",
      "node",
      "bash",
      "git",
      "zip",
      "unzip",
      "jq",
      "duckdb",
      "pdfjs",
    ]),
    preflight: limits(20_000),
    execution: limits(240_000),
  }),
  codex: Object.freeze({
    prerequisites: Object.freeze([...common, "Node.js", "Installed repository Codex CLI"]),
    versionKeys: Object.freeze(["bun", "node", "codex"]),
    preflight: limits(10_000),
    execution: limits(120_000),
  }),
  pandoc: Object.freeze({
    prerequisites: Object.freeze([...common, "Pandoc"]),
    versionKeys: Object.freeze(["bun", "pandoc"]),
    preflight: limits(10_000),
    execution: limits(30_000),
  }),
});
