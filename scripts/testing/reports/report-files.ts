import { XMLParser, XMLValidator } from "fast-xml-parser";

import { classifyTestFiles } from "../suites/selection.ts";

/** File-identity evidence only; exit status, counts, freshness, and outcomes are separate checks. */
export function reportedTestFiles(xml: string): string[] {
  if (XMLValidator.validate(xml) !== true) throw new Error("Malformed test report XML.");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
    isArray: (name) => name === "testsuite" || name === "testcase",
  }).parse(xml) as Record<string, unknown>;
  if (!Object.hasOwn(parsed, "testsuites") && !Object.hasOwn(parsed, "testsuite")) {
    throw new Error("Missing test report root.");
  }
  const files = new Set<string>();
  let cases = 0;
  function visit(value: unknown, inheritedFile?: string): void {
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, inheritedFile));
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    const file = node["@_file"] ?? inheritedFile;
    if (file !== undefined && typeof file !== "string")
      throw new Error("Invalid report file identity.");
    if (typeof file === "string") files.add(file.replace(/^\.\//, ""));
    const tests = node.testcase;
    if (Array.isArray(tests)) {
      for (const test of tests) {
        const testFile = (test as Record<string, unknown>)["@_file"] ?? file;
        if (typeof testFile !== "string" || !testFile)
          throw new Error("Testcase has no file identity.");
        files.add(testFile.replace(/^\.\//, ""));
        cases++;
      }
    }
    visit(node.testsuites, file as string | undefined);
    visit(node.testsuite, file as string | undefined);
  }
  visit(parsed);
  if (!cases) throw new Error("Test report contains no testcases.");
  return [...files].sort();
}

export function assertReportedTestFiles(
  selected: readonly string[],
  reported: readonly string[],
): void {
  if (!selected.length) throw new Error("Cannot reconcile an empty selection.");
  const membership = classifyTestFiles(selected);
  if (membership.inputs.length) throw new Error("Selected tests include excluded fixture inputs.");
  const expected = new Set(selected.map((path) => path.replace(/^\.\//, "")));
  const actual = new Set(reported.map((path) => path.replace(/^\.\//, "")));
  const missing = [...expected].filter((path) => !actual.has(path));
  const unexpected = [...actual].filter((path) => !expected.has(path));
  if (missing.length || unexpected.length) {
    throw new Error(
      `Report file mismatch: missing [${missing.join(", ")}]; unexpected [${unexpected.join(", ")}].`,
    );
  }
}
