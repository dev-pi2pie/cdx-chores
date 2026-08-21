import { InvalidArgumentError } from "commander";

export const DEFAULT_CODEX_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_CODEX_REQUEST_TIMEOUT_MS = 600_000;

const CODEX_TIMEOUT_DURATION_PATTERN = /^([1-9][0-9]*)(ms|s|m)$/u;

export type CodexTimeoutSource = "scoped" | "legacy-scoped" | "shared" | "default";

export interface ResolvedCodexTimeout {
  timeoutMs: number;
  source: CodexTimeoutSource;
  optionName?: string;
}

export interface ResolveCodexTimeoutOptions {
  sharedTimeoutMs?: number;
  sharedOptionName?: string;
  scopedTimeoutMs?: number;
  scopedOptionName: string;
  legacyScopedTimeoutMs?: number;
  legacyScopedOptionName: string;
  defaultTimeoutMs?: number;
}

export interface LegacyCodexTimeoutMigration {
  legacyOptionName: string;
  replacementOptionName: string;
  timeoutMs: number;
}

function durationError(optionName: string): InvalidArgumentError {
  return new InvalidArgumentError(
    `${optionName} must be a positive integer duration using ms, s, or m (maximum 10m).`,
  );
}

export function parseCodexTimeoutDuration(value: string, optionName: string): number {
  const match = CODEX_TIMEOUT_DURATION_PATTERN.exec(value);
  if (!match) {
    throw durationError(optionName);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "ms" ? 1 : unit === "s" ? 1_000 : 60_000;
  const timeoutMs = amount * multiplier;

  if (
    !Number.isSafeInteger(amount) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs > MAX_CODEX_REQUEST_TIMEOUT_MS
  ) {
    throw durationError(optionName);
  }

  return timeoutMs;
}

export function parseUniqueCodexTimeoutDuration(
  value: string,
  previous: number | undefined,
  optionName: string,
): number {
  if (previous !== undefined) {
    throw new InvalidArgumentError(`${optionName} may only be specified once.`);
  }

  return parseCodexTimeoutDuration(value, optionName);
}

export function resolveCodexTimeout(options: ResolveCodexTimeoutOptions): ResolvedCodexTimeout {
  if (options.scopedTimeoutMs !== undefined && options.legacyScopedTimeoutMs !== undefined) {
    throw new InvalidArgumentError(
      `${options.scopedOptionName} cannot be used with ${options.legacyScopedOptionName}.`,
    );
  }

  if (options.scopedTimeoutMs !== undefined) {
    return {
      timeoutMs: options.scopedTimeoutMs,
      source: "scoped",
      optionName: options.scopedOptionName,
    };
  }

  if (options.legacyScopedTimeoutMs !== undefined) {
    return {
      timeoutMs: options.legacyScopedTimeoutMs,
      source: "legacy-scoped",
      optionName: options.legacyScopedOptionName,
    };
  }

  if (options.sharedTimeoutMs !== undefined) {
    return {
      timeoutMs: options.sharedTimeoutMs,
      source: "shared",
      optionName: options.sharedOptionName ?? "--codex-timeout",
    };
  }

  return {
    timeoutMs: options.defaultTimeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS,
    source: "default",
  };
}

function hasExactDurationReplacement(timeoutMs: number): boolean {
  return (
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_CODEX_REQUEST_TIMEOUT_MS
  );
}

function formatLegacyValue(timeoutMs: number): string {
  return Number.isNaN(timeoutMs) ? "NaN" : String(timeoutMs);
}

export function formatLegacyCodexTimeoutNotice(
  migrations: readonly LegacyCodexTimeoutMigration[],
): string | undefined {
  if (migrations.length === 0) {
    return undefined;
  }

  const noun = migrations.length === 1 ? "option is" : "options are";
  const compatibilityNoun = migrations.length === 1 ? "option remains" : "options remain";
  const lines = [`Warning: legacy Codex timeout ${noun} deprecated.`];

  for (const migration of migrations) {
    if (hasExactDurationReplacement(migration.timeoutMs)) {
      lines.push(
        `Use ${migration.replacementOptionName} ${migration.timeoutMs}ms instead of ${migration.legacyOptionName}.`,
      );
      continue;
    }

    lines.push(
      `${migration.legacyOptionName} value ${formatLegacyValue(migration.timeoutMs)} cannot migrate unchanged to ${migration.replacementOptionName}; use a positive integer duration of 10m or less.`,
    );
  }

  lines.push(`The legacy ${compatibilityNoun} supported during the current compatibility phase.`);
  return `${lines.join("\n")}\n`;
}
