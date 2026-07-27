import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { discoverSystemFonts } from "../../src/fonts";
import type { DiscoverFontsInput, DiscoverFontsResult } from "../../src/fonts";

const DEFAULT_RUNS = 30;
const MAX_TIMEOUT_MS = 2_147_483_647;
const POLICY_THRESHOLDS_MS = [1_000, 3_000, 10_000] as const;

type DiscoveryOutcome = "success" | "failed" | "timeout";
type DiscoverFonts = (input?: DiscoverFontsInput) => Promise<DiscoverFontsResult>;

export interface EvidenceSpikeOptions {
  runs: number;
  timeoutMs: number;
}

export interface DurationSummary {
  sampleCount: number;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

interface RunEvidence {
  outcome: DiscoveryOutcome;
  totalDurationMs: number;
  adapterDurationMs?: number;
  emptyResult: boolean;
}

export interface FontDiscoveryEvidenceReport {
  schemaVersion: 1;
  parameters: {
    discovery: "fontconfig";
    runs: number;
    timeoutMs: number;
    serial: true;
  };
  environment: {
    platform: NodeJS.Platform;
    arch: string;
    runtime:
      | {
          name: "node";
          version: string;
        }
      | {
          name: "bun";
          version: string;
          nodeCompatibilityVersion: string;
        };
  };
  percentileMethod: "nearest-rank";
  firstRun: RunEvidence;
  subsequentRuns: {
    runCount: number;
    totalDurationMs: DurationSummary;
    adapterDurationMs: DurationSummary;
  };
  allRuns: {
    totalDurationMs: DurationSummary;
    adapterDurationMs: DurationSummary;
  };
  outcomes: {
    success: number;
    failed: number;
    timeout: number;
    emptyResult: number;
  };
  thresholds: Array<{
    thresholdMs: (typeof POLICY_THRESHOLDS_MS)[number];
    runsAtOrAbove: number;
  }>;
}

export class EvidenceSpikeInputError extends Error {}

function parsePositiveSafeInteger(
  flag: string,
  value: string | undefined,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined || value.startsWith("--")) {
    throw new EvidenceSpikeInputError(`${flag} requires a value.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new EvidenceSpikeInputError(`${flag} must be a positive safe integer.`);
  }
  if (parsed > maximum) {
    throw new EvidenceSpikeInputError(`${flag} must be no greater than ${maximum}.`);
  }
  return parsed;
}

export function parseEvidenceSpikeArgs(args: string[]): EvidenceSpikeOptions {
  let runs = DEFAULT_RUNS;
  let timeoutMs: number | undefined;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (flag !== "--runs" && flag !== "--timeout-ms") {
      throw new EvidenceSpikeInputError(`Unknown argument: ${flag ?? ""}`);
    }
    if (seen.has(flag)) {
      throw new EvidenceSpikeInputError(`Duplicate argument: ${flag}`);
    }
    seen.add(flag);

    const value = args[index + 1];
    const parsed = parsePositiveSafeInteger(
      flag,
      value,
      flag === "--timeout-ms" ? MAX_TIMEOUT_MS : Number.MAX_SAFE_INTEGER,
    );
    if (flag === "--runs") {
      runs = parsed;
    } else {
      timeoutMs = parsed;
    }
  }

  if (timeoutMs === undefined) {
    throw new EvidenceSpikeInputError("--timeout-ms is required.");
  }

  return { runs, timeoutMs };
}

function roundMilliseconds(value: number): number {
  return Math.round(Math.max(0, value) * 1_000) / 1_000;
}

function nearestRank(sorted: number[], percentile: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const rank = Math.ceil(percentile * sorted.length);
  return sorted[Math.max(0, rank - 1)] ?? null;
}

export function summarizeDurations(values: number[]): DurationSummary {
  const sorted = values.toSorted((left, right) => left - right);
  return {
    sampleCount: sorted.length,
    p50: nearestRank(sorted, 0.5),
    p95: nearestRank(sorted, 0.95),
    max: sorted.at(-1) ?? null,
  };
}

function outcomeFromResult(result: DiscoverFontsResult): DiscoveryOutcome {
  const status = result.attempts?.[0]?.status;
  if (status === "success" || status === "timeout") {
    return status;
  }
  return "failed";
}

function runtimeEnvironment(): FontDiscoveryEvidenceReport["environment"]["runtime"] {
  const bunVersion = Reflect.get(process.versions, "bun");
  if (typeof bunVersion === "string") {
    return {
      name: "bun",
      version: bunVersion,
      nodeCompatibilityVersion: process.versions.node,
    };
  }
  return {
    name: "node",
    version: process.versions.node,
  };
}

async function measureRun(
  options: EvidenceSpikeOptions,
  discover: DiscoverFonts,
  now: () => number,
): Promise<RunEvidence> {
  const startedAt = now();
  try {
    const result = await discover({
      discovery: "fontconfig",
      includeAttempts: true,
      timeoutMs: options.timeoutMs,
    });
    const attempt = result.attempts?.[0];
    const outcome = outcomeFromResult(result);
    return {
      outcome,
      totalDurationMs: roundMilliseconds(now() - startedAt),
      ...(attempt ? { adapterDurationMs: attempt.durationMs } : {}),
      emptyResult: outcome === "success" && result.faces.length === 0,
    };
  } catch {
    return {
      outcome: "failed",
      totalDurationMs: roundMilliseconds(now() - startedAt),
      emptyResult: false,
    };
  }
}

export async function collectFontDiscoveryEvidence(
  options: EvidenceSpikeOptions,
  dependencies: {
    discover?: DiscoverFonts;
    now?: () => number;
  } = {},
): Promise<FontDiscoveryEvidenceReport> {
  const discover = dependencies.discover ?? discoverSystemFonts;
  const now = dependencies.now ?? performance.now.bind(performance);
  const runs: RunEvidence[] = [];

  for (let index = 0; index < options.runs; index += 1) {
    runs.push(await measureRun(options, discover, now));
  }

  const firstRun = runs[0];
  if (!firstRun) {
    throw new Error("Evidence collection requires at least one run.");
  }
  const subsequentRuns = runs.slice(1);
  const successfulRuns = runs.filter((run) => run.outcome === "success");
  const successfulSubsequentRuns = subsequentRuns.filter((run) => run.outcome === "success");
  const totalDurations = runs.map((run) => run.totalDurationMs);
  const successfulTotalDurations = successfulRuns.map((run) => run.totalDurationMs);
  const successfulAdapterDurations = successfulRuns.flatMap((run) =>
    run.adapterDurationMs === undefined ? [] : [run.adapterDurationMs],
  );

  return {
    schemaVersion: 1,
    parameters: {
      discovery: "fontconfig",
      runs: options.runs,
      timeoutMs: options.timeoutMs,
      serial: true,
    },
    environment: {
      platform: process.platform,
      arch: process.arch,
      runtime: runtimeEnvironment(),
    },
    percentileMethod: "nearest-rank",
    firstRun,
    subsequentRuns: {
      runCount: subsequentRuns.length,
      totalDurationMs: summarizeDurations(
        successfulSubsequentRuns.map((run) => run.totalDurationMs),
      ),
      adapterDurationMs: summarizeDurations(
        successfulSubsequentRuns.flatMap((run) =>
          run.adapterDurationMs === undefined ? [] : [run.adapterDurationMs],
        ),
      ),
    },
    allRuns: {
      totalDurationMs: summarizeDurations(successfulTotalDurations),
      adapterDurationMs: summarizeDurations(successfulAdapterDurations),
    },
    outcomes: {
      success: runs.filter((run) => run.outcome === "success").length,
      failed: runs.filter((run) => run.outcome === "failed").length,
      timeout: runs.filter((run) => run.outcome === "timeout").length,
      emptyResult: runs.filter((run) => run.emptyResult).length,
    },
    thresholds: POLICY_THRESHOLDS_MS.map((thresholdMs) => ({
      thresholdMs,
      runsAtOrAbove: totalDurations.filter((durationMs) => durationMs >= thresholdMs).length,
    })),
  };
}

async function main(): Promise<void> {
  try {
    const options = parseEvidenceSpikeArgs(process.argv.slice(2));
    const report = await collectFontDiscoveryEvidence(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const message =
      error instanceof EvidenceSpikeInputError
        ? error.message
        : "Font discovery evidence collection failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entryUrl === import.meta.url) {
  await main();
}
