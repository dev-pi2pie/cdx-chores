import { describe, expect, test } from "bun:test";

import { parsePreflightReport } from "../../scripts/testing/execution/prerequisites.ts";
import { SUITES } from "../../scripts/testing/suites/selection.ts";
import { SUITE_POLICIES } from "../../scripts/testing/suites/suite-policy.ts";

describe("suite prerequisite contract", () => {
  test("unit declares only the runner and process observation", () => {
    expect(SUITE_POLICIES.unit.prerequisites).toEqual([
      "Bun",
      "compatible ps observation and POSIX process-group access",
    ]);
    expect(SUITE_POLICIES.unit.versionKeys).toEqual(["bun"]);
  });

  test("every leaf has bounded execution and separate termination allowances", () => {
    expect(Object.keys(SUITE_POLICIES)).toEqual([...SUITES]);
    for (const suite of SUITES) {
      for (const limits of [SUITE_POLICIES[suite].preflight, SUITE_POLICIES[suite].execution]) {
        expect(limits.timeoutMs).toBeGreaterThan(0);
        expect(limits.cleanupMs).toBeGreaterThan(limits.graceMs);
        expect(Object.isFrozen(limits)).toBe(true);
      }
    }
  });

  test("accepts exactly the selected suite's required versions", () => {
    expect(
      parsePreflightReport(
        JSON.stringify({ schema: 1, suite: "unit", versions: { bun: "1.4.1" } }),
        "unit",
      ),
    ).toEqual({ versions: { bun: "1.4.1" } });
  });

  test.each([
    "not JSON",
    "[]",
    "{}",
    JSON.stringify({ schema: 1, suite: "app", versions: { bun: "1.4.1" } }),
    JSON.stringify({ schema: 1, suite: "unit", versions: {} }),
    JSON.stringify({ schema: 1, suite: "unit", versions: { bun: "1.4.1", node: "24.18.0" } }),
    JSON.stringify({ schema: 1, suite: "unit", versions: { bun: "/private/personal" } }),
    JSON.stringify({ schema: 1, suite: "unit", error: "raw private tool failure" }),
  ])("rejects malformed, mismatched, incomplete or unsafe reports: %s", (report) => {
    expect(parsePreflightReport(report, "unit")).toEqual({
      error: "Prerequisite probe returned an invalid report.",
    });
  });

  test("failure diagnostics are limited to declared prerequisite labels", () => {
    expect(
      parsePreflightReport(
        JSON.stringify({
          schema: 1,
          suite: "app",
          error: "Current DuckDB excel and sqlite_scanner extension cache",
        }),
        "app",
      ),
    ).toEqual({
      error:
        "Required prerequisite is unavailable: Current DuckDB excel and sqlite_scanner extension cache.",
    });
  });
});
