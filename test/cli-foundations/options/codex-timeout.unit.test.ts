import { describe, expect, test } from "bun:test";
import { InvalidArgumentError } from "commander";

import {
  DEFAULT_CODEX_REQUEST_TIMEOUT_MS,
  MAX_CODEX_REQUEST_TIMEOUT_MS,
  formatLegacyCodexTimeoutNotice,
  parseCodexTimeoutDuration,
  parseUniqueCodexTimeoutDuration,
  resolveCodexTimeout,
} from "../../../src/cli/options/codex-timeout";

describe("Codex timeout duration parsing", () => {
  test.each([
    ["1ms", 1],
    ["500ms", 500],
    ["30s", 30_000],
    ["2m", 120_000],
    ["600000ms", MAX_CODEX_REQUEST_TIMEOUT_MS],
    ["600s", MAX_CODEX_REQUEST_TIMEOUT_MS],
    ["10m", MAX_CODEX_REQUEST_TIMEOUT_MS],
  ] as const)("parses %s as %d milliseconds", (value, expected) => {
    expect(parseCodexTimeoutDuration(value, "--codex-timeout")).toBe(expected);
  });

  test.each([
    "30",
    "0ms",
    "-1ms",
    "1.5s",
    " 30s",
    "30s ",
    "30 s",
    "30S",
    "1h",
    "1m30s",
    "600001ms",
    "601s",
    "11m",
    "9007199254740992ms",
    "999999999999999999999999999999999999999999999999999999999999999999999999m",
  ])("rejects invalid duration %j", (value) => {
    expect(() => parseCodexTimeoutDuration(value, "--codex-docs-timeout")).toThrow(
      new InvalidArgumentError(
        "--codex-docs-timeout must be a positive integer duration using ms, s, or m (maximum 10m).",
      ),
    );
  });

  test("rejects a repeated duration option instead of accepting the last value", () => {
    const first = parseUniqueCodexTimeoutDuration("30s", undefined, "--codex-timeout");

    expect(() => parseUniqueCodexTimeoutDuration("2m", first, "--codex-timeout")).toThrow(
      new InvalidArgumentError("--codex-timeout may only be specified once."),
    );
  });
});

describe("Codex timeout resolution", () => {
  const optionNames = {
    sharedOptionName: "--codex-timeout",
    scopedOptionName: "--codex-docs-timeout",
    legacyScopedOptionName: "--codex-docs-timeout-ms",
  };

  test("uses the shared default when no public value is present", () => {
    expect(resolveCodexTimeout(optionNames)).toEqual({
      timeoutMs: DEFAULT_CODEX_REQUEST_TIMEOUT_MS,
      source: "default",
    });
  });

  test("retains an explicit alternate internal default", () => {
    expect(resolveCodexTimeout({ ...optionNames, defaultTimeoutMs: 45_000 })).toEqual({
      timeoutMs: 45_000,
      source: "default",
    });
  });

  test("uses a shared timeout before the default", () => {
    expect(resolveCodexTimeout({ ...optionNames, sharedTimeoutMs: 60_000 })).toEqual({
      timeoutMs: 60_000,
      source: "shared",
      optionName: "--codex-timeout",
    });
  });

  test("uses a legacy scoped timeout before a shared timeout", () => {
    expect(
      resolveCodexTimeout({
        ...optionNames,
        sharedTimeoutMs: 60_000,
        legacyScopedTimeoutMs: 75_000,
      }),
    ).toEqual({
      timeoutMs: 75_000,
      source: "legacy-scoped",
      optionName: "--codex-docs-timeout-ms",
    });
  });

  test("uses a new scoped timeout before a shared timeout", () => {
    expect(
      resolveCodexTimeout({
        ...optionNames,
        sharedTimeoutMs: 60_000,
        scopedTimeoutMs: 90_000,
      }),
    ).toEqual({
      timeoutMs: 90_000,
      source: "scoped",
      optionName: "--codex-docs-timeout",
    });
  });

  test("rejects a new and legacy scoped timeout for the same analyzer", () => {
    expect(() =>
      resolveCodexTimeout({
        ...optionNames,
        scopedTimeoutMs: 30_000,
        legacyScopedTimeoutMs: 60_000,
      }),
    ).toThrow(
      new InvalidArgumentError("--codex-docs-timeout cannot be used with --codex-docs-timeout-ms."),
    );
  });
});

describe("legacy Codex timeout migration notices", () => {
  test("omits a notice when no legacy option was supplied", () => {
    expect(formatLegacyCodexTimeoutNotice([])).toBeUndefined();
  });

  test("formats one exact replacement", () => {
    expect(
      formatLegacyCodexTimeoutNotice([
        {
          legacyOptionName: "--codex-docs-timeout-ms",
          replacementOptionName: "--codex-docs-timeout",
          timeoutMs: 30_000,
        },
      ]),
    ).toBe(
      [
        "Warning: legacy Codex timeout option is deprecated.",
        "Use --codex-docs-timeout 30000ms instead of --codex-docs-timeout-ms.",
        "The legacy option remains supported during the current compatibility phase.",
        "",
      ].join("\n"),
    );
  });

  test("consolidates two exact replacements into one notice", () => {
    const notice = formatLegacyCodexTimeoutNotice([
      {
        legacyOptionName: "--codex-images-timeout-ms",
        replacementOptionName: "--codex-images-timeout",
        timeoutMs: 15_000,
      },
      {
        legacyOptionName: "--codex-docs-timeout-ms",
        replacementOptionName: "--codex-docs-timeout",
        timeoutMs: 45_000,
      },
    ]);

    expect(notice).toBe(
      [
        "Warning: legacy Codex timeout options are deprecated.",
        "Use --codex-images-timeout 15000ms instead of --codex-images-timeout-ms.",
        "Use --codex-docs-timeout 45000ms instead of --codex-docs-timeout-ms.",
        "The legacy options remain supported during the current compatibility phase.",
        "",
      ].join("\n"),
    );
  });

  test.each([0, -1, 1.5, 600_001, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not suggest an invalid exact replacement for legacy value %s",
    (timeoutMs) => {
      const notice = formatLegacyCodexTimeoutNotice([
        {
          legacyOptionName: "--codex-docs-timeout-ms",
          replacementOptionName: "--codex-docs-timeout",
          timeoutMs,
        },
      ]);

      expect(notice).toContain("cannot migrate unchanged");
      expect(notice).not.toContain(`Use --codex-docs-timeout ${String(timeoutMs)}ms instead`);
    },
  );
});
