import { describe, expect, test } from "bun:test";

import {
  assertUnitDiscoveryConfig,
  classifyTestFiles,
  exactTestArguments,
  isBunTestFile,
  selectTestFiles,
  SUITES,
  UNIT_IGNORE_PATTERNS,
} from "../../scripts/testing/suites/selection.ts";
import {
  assertReportedTestFiles,
  reportedTestFiles,
} from "../../scripts/testing/reports/report-files.ts";

describe("suite selection contracts", () => {
  test("recognizes every Bun filename form before applying the stricter suite policy", () => {
    for (const delimiter of [".", "_"]) {
      for (const kind of ["test", "spec"]) {
        for (const extension of ["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts"]) {
          const path = `test/example${delimiter}${kind}.${extension}`;
          expect(isBunTestFile(path)).toBe(true);
          expect(() => classifyTestFiles([path])).toThrow("suite suffix");
        }
      }
    }
    expect(isBunTestFile("test/support.ts")).toBe(false);
    expect(isBunTestFile("test/example.test.ts.map")).toBe(false);
  });

  test("sorts disjoint suite owners and accounts separately for test-shaped inputs", () => {
    const { suites, inputs } = classifyTestFiles([
      "test/zeta.unit.test.ts",
      "test/live.codex.test.ts",
      "test/fixtures/input.spec.js",
      "./test/alpha.unit.test.ts",
      "test/render.pandoc.test.ts",
      "test/process.app.test.ts",
    ]);
    expect(suites.unit).toEqual(["test/alpha.unit.test.ts", "test/zeta.unit.test.ts"]);
    expect(inputs).toEqual(["test/fixtures/input.spec.js"]);
    expect(selectTestFiles(suites, SUITES)).toEqual([
      "test/alpha.unit.test.ts",
      "test/live.codex.test.ts",
      "test/process.app.test.ts",
      "test/render.pandoc.test.ts",
      "test/zeta.unit.test.ts",
    ]);
  });

  test("rejects out-of-tree, unknown, duplicate, and unsafe path identities", () => {
    for (const path of [
      "src/a.unit.test.ts",
      "test/a.other.test.ts",
      "../test/a.unit.test.ts",
      "/test/a.unit.test.ts",
    ]) {
      expect(() => classifyTestFiles([path])).toThrow();
    }
    expect(() => classifyTestFiles(["test/a.unit.test.ts", "./test/a.unit.test.ts"])).toThrow(
      "Duplicate",
    );
  });

  test("refuses empty, duplicate, mismatched, or excluded selections before launch", () => {
    const { suites } = classifyTestFiles(["test/a.unit.test.ts"]);
    expect(() => selectTestFiles(suites, [])).toThrow("at least one");
    expect(() => selectTestFiles(suites, ["app"])).toThrow("no tests");
    expect(() => selectTestFiles(suites, ["unit", "unit"])).toThrow("Duplicate");
    expect(() => selectTestFiles({ ...suites, app: suites.unit }, ["app"])).toThrow(
      "does not belong",
    );
    expect(() => exactTestArguments([])).toThrow("empty");
    expect(() => exactTestArguments(["test/fixtures/input.unit.test.ts"])).toThrow("excluded");
  });

  test("constructs exact paths with the common ignore override", () => {
    expect(exactTestArguments(["test/b.app.test.ts", "test/a.unit.test.ts"])).toEqual([
      "test",
      "./test/a.unit.test.ts",
      "./test/b.app.test.ts",
      "--path-ignore-patterns",
      "**/fixtures/**",
    ]);
  });

  test("detects root and exclusion drift without rejecting unrelated config settings", () => {
    const config = {
      test: { root: "./test", pathIgnorePatterns: UNIT_IGNORE_PATTERNS, timeout: 5000 },
    };
    expect(() => assertUnitDiscoveryConfig(config)).not.toThrow();
    expect(() => assertUnitDiscoveryConfig({ test: { ...config.test, root: "." } })).toThrow(
      "root",
    );
    expect(() =>
      assertUnitDiscoveryConfig({
        test: { ...config.test, pathIgnorePatterns: ["**/fixtures/**"] },
      }),
    ).toThrow("disagree");
    expect(() =>
      assertUnitDiscoveryConfig({
        test: { ...config.test, pathIgnorePatterns: [...UNIT_IGNORE_PATTERNS, "**/support/**"] },
      }),
    ).toThrow("disagree");
  });
});

describe("report file correspondence", () => {
  test("reconciles nested suites and inherited testcase identities", () => {
    const files = reportedTestFiles(
      '<testsuites><testsuite file="test/a.unit.test.ts"><testsuite><testcase name="one"/><testcase name="two" file="./test/a.unit.test.ts"/></testsuite></testsuite></testsuites>',
    );
    expect(files).toEqual(["test/a.unit.test.ts"]);
    expect(() => assertReportedTestFiles(["./test/a.unit.test.ts"], files)).not.toThrow();
  });

  test("rejects missing and unexpected report identities", () => {
    expect(() => assertReportedTestFiles(["test/a.unit.test.ts"], ["test/b.unit.test.ts"])).toThrow(
      "missing [test/a.unit.test.ts]; unexpected [test/b.unit.test.ts]",
    );
    expect(() =>
      reportedTestFiles(
        '<testsuites><testsuite><testcase name="no file"/></testsuite></testsuites>',
      ),
    ).toThrow("no file identity");
    expect(() => reportedTestFiles("<testsuites/>")).toThrow("no testcases");
    expect(() => reportedTestFiles("<testsuites>")).toThrow("Malformed");
  });
});
