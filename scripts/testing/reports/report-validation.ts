import { XMLParser, XMLValidator } from "fast-xml-parser";

import { assertReportedTestFiles } from "./report-files.ts";

export type JUnitSummary = {
  tests: number;
  assertions: number;
  failures: number;
  errors: number;
  skipped: number;
  durationSeconds: number;
  files: string[];
};

type Counts = Omit<JUnitSummary, "files">;
type XmlNode = Record<string, unknown>;
const COUNT_FIELDS = ["tests", "assertions", "failures", "errors", "skipped"] as const;
const RECORDS = new Set([
  "testsuites",
  "testsuite",
  "testcase",
  "failure",
  "error",
  "skipped",
  "todo",
]);

function node(value: unknown): XmlNode {
  if (value === "") return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid test report record.");
  }
  return value as XmlNode;
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`Invalid test report ${field} count.`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error(`Invalid test report ${field} count.`);
  return result;
}

function duration(record: XmlNode, fallback = 0): number {
  const value = record["@_time"];
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    throw new Error("Invalid test report duration.");
  }
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error("Invalid test report duration.");
  return result;
}

function flag(record: XmlNode, key: string): boolean {
  const value = record[`@_${key}`];
  if (value === undefined || value === "false" || value === "0") return false;
  if (value === "true" || value === "1") return true;
  throw new Error(`Invalid test report ${key} flag.`);
}

function emptyCounts(): Counts {
  return { tests: 0, assertions: 0, failures: 0, errors: 0, skipped: 0, durationSeconds: 0 };
}

function add(total: Counts, part: Counts): void {
  for (const key of COUNT_FIELDS) {
    total[key] += part[key];
    if (!Number.isSafeInteger(total[key])) throw new Error(`Invalid test report ${key} total.`);
  }
  total.durationSeconds += part.durationSeconds;
  if (!Number.isFinite(total.durationSeconds)) throw new Error("Invalid test report duration.");
}

function checkChildren(record: XmlNode, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (key.startsWith("@_")) continue;
    if (!allowed.includes(key)) throw new Error(`Unexpected test report element: ${key}.`);
  }
}

function checkMetadata(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(checkMetadata);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (RECORDS.has(key)) throw new Error(`Misplaced test report element: ${key}.`);
      checkMetadata(child);
    }
  }
}

function fileIdentity(record: XmlNode, inherited?: string): string | undefined {
  const value = record["@_file"] ?? inherited;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid report file identity.");
  return value.replace(/^\.\//, "");
}

/** Derives counts from testcase records; contradictory declared totals invalidate all counts. */
export function validateJUnitReport(xml: string, selected: readonly string[]): JUnitSummary {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Error("Test report declarations are forbidden.");
  }
  if (XMLValidator.validate(xml) !== true) throw new Error("Malformed test report XML.");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    processEntities: false,
    isArray: (name) => RECORDS.has(name),
  }).parse(xml) as XmlNode;
  const rootKeys = Object.keys(parsed).filter((key) => key !== "?xml");
  const rootKey = rootKeys[0];
  if (rootKeys.length !== 1 || (rootKey !== "testsuite" && rootKey !== "testsuites")) {
    throw new Error("Missing or multiple test report roots.");
  }
  const roots = parsed[rootKey] as unknown[];
  if (roots.length !== 1) throw new Error("Multiple test report roots.");
  const files = new Set<string>();

  function testcase(value: unknown, inheritedFile?: string): Counts {
    const record = node(value);
    checkChildren(record, [
      "failure",
      "error",
      "skipped",
      "todo",
      "system-out",
      "system-err",
      "properties",
    ]);
    for (const key of ["properties", "system-out", "system-err"]) checkMetadata(record[key]);
    if (typeof record["@_name"] !== "string" || !record["@_name"].trim()) {
      throw new Error("Testcase has no name.");
    }
    const file = fileIdentity(record, inheritedFile);
    if (!file) throw new Error("Testcase has no file identity.");
    // Only actual testcase identities count toward selected-file correspondence.
    files.add(file);
    const result = emptyCounts();
    result.tests = 1;
    result.assertions =
      record["@_assertions"] === undefined ? 0 : integer(record["@_assertions"], "assertions");
    result.durationSeconds = duration(record);
    for (const [element, field] of [
      ["failure", "failures"],
      ["error", "errors"],
      ["skipped", "skipped"],
      ["todo", "skipped"],
    ] as const) {
      const entries = record[element] as unknown[] | undefined;
      if (entries && entries.length !== 1)
        throw new Error(`Duplicate testcase ${element} records.`);
      if (entries) checkMetadata(entries);
      if (entries) result[field]++;
    }
    const status = record["@_status"];
    if (
      status !== undefined &&
      !["run", "passed", "failed", "error", "skipped", "todo", "notrun", "disabled"].includes(
        String(status),
      )
    ) {
      throw new Error("Unknown testcase status.");
    }
    const skipAttribute = ["skip", "skipped", "todo", "disabled"]
      .map((key) => flag(record, key))
      .some(Boolean);
    if (skipAttribute || ["skipped", "todo", "notrun", "disabled"].includes(String(status)))
      result.skipped = Math.max(1, result.skipped);
    if (
      result.failures + result.errors + result.skipped > 1 ||
      ((status === "run" || status === "passed") && result.skipped > 0) ||
      (status === "passed" && result.failures + result.errors > 0) ||
      (status === "failed" && result.failures !== 1) ||
      (status === "error" && result.errors !== 1)
    ) {
      throw new Error("Contradictory testcase outcomes.");
    }
    for (const field of ["tests", "failures", "errors"] as const) {
      if (
        record[`@_${field}`] !== undefined &&
        integer(record[`@_${field}`], field) !== result[field]
      ) {
        throw new Error(`Contradictory testcase ${field} count.`);
      }
    }
    return result;
  }

  function suite(value: unknown, inheritedFile?: string): Counts {
    const record = node(value);
    checkChildren(record, [
      "testsuites",
      "testsuite",
      "testcase",
      "properties",
      "system-out",
      "system-err",
    ]);
    for (const key of ["properties", "system-out", "system-err"]) checkMetadata(record[key]);
    const file = fileIdentity(record, inheritedFile);
    const result = emptyCounts();
    for (const entry of (record.testcase as unknown[] | undefined) ?? [])
      add(result, testcase(entry, file));
    for (const kind of ["testsuite", "testsuites"]) {
      for (const entry of (record[kind] as unknown[] | undefined) ?? [])
        add(result, suite(entry, file));
    }
    for (const field of COUNT_FIELDS) {
      if (
        record[`@_${field}`] !== undefined &&
        integer(record[`@_${field}`], field) !== result[field]
      ) {
        throw new Error(`Contradictory test report ${field} total.`);
      }
    }
    for (const field of ["todo", "disabled"]) {
      if (record[`@_${field}`] !== undefined && integer(record[`@_${field}`], field) !== 0) {
        throw new Error(`Unsupported test report ${field} total.`);
      }
    }
    // Suite wall times include setup/teardown and rounded describe times; they are not additive.
    result.durationSeconds = duration(record, result.durationSeconds);
    return result;
  }

  const summary = suite(roots[0]);
  if (!summary.tests || summary.tests === summary.skipped) {
    throw new Error("Test report contains no executed testcases.");
  }
  const reported = [...files].sort();
  assertReportedTestFiles(selected, reported);
  return { ...summary, files: reported };
}

/** Process exit, freshness, and lifecycle checks remain independent requirements. */
export function assertJUnitPassed(summary: JUnitSummary): void {
  if (summary.failures || summary.errors || summary.skipped) {
    throw new Error(
      `Test report contains ${summary.failures} failures, ${summary.errors} errors, and ${summary.skipped} skipped/TODO cases.`,
    );
  }
}
