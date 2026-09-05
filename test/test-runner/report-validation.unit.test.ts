import { describe, expect, test } from "bun:test";

import { assertJUnitPassed, validateJUnitReport } from "../../scripts/testing/report-validation.ts";

const FILE = "test/example.unit.test.ts";
const CASE = '<testcase name="one" assertions="2" time="0.001" />';

function report(cases = CASE, suiteAttributes = ""): string {
  return `<testsuites><testsuite file="${FILE}" ${suiteAttributes}>${cases}</testsuite></testsuites>`;
}

describe("JUnit validation", () => {
  test("accepts Bun's nested suite shape and uses wall duration without adding ancestor totals", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <testsuites name="bun test" tests="2" assertions="4" failures="0" skipped="0" time="0.009">
        <testsuite name="${FILE}" file="${FILE}" tests="2" assertions="4" failures="0" skipped="0" time="0.004">
          <testsuite name="describe" tests="2" assertions="4" failures="0" skipped="0" time="0">
            ${CASE}${CASE}
          </testsuite>
        </testsuite>
      </testsuites>`;
    const summary = validateJUnitReport(xml, [FILE]);
    expect(summary).toEqual({
      tests: 2,
      assertions: 4,
      failures: 0,
      errors: 0,
      skipped: 0,
      durationSeconds: 0.009,
      files: [FILE],
    });
    expect(() => assertJUnitPassed(summary)).not.toThrow();
  });

  test("counts duplicate parameterized names and direct testcases alongside nested suites", () => {
    const xml = `<testsuite file="./${FILE}" tests="3" assertions="6">${CASE}<testsuite>${CASE}${CASE}</testsuite></testsuite>`;
    expect(validateJUnitReport(xml, [`./${FILE}`]).tests).toBe(3);
  });

  test("supports escaped testcase names and captured output", () => {
    const xml = report(
      '<testcase name="&quot;value&quot; &amp; result"><system-out><![CDATA[<testcase fake>]]></system-out></testcase>',
    );
    expect(validateJUnitReport(xml, [FILE]).tests).toBe(1);
  });

  test.each([
    "",
    "<testsuites>",
    "<other/>",
    "<testsuites/><testsuites/>",
    "<testsuite/><other/>",
    '<!DOCTYPE testsuites [<!ENTITY injected "x">]><testsuites/>',
    '<!DOCTYPE testsuites SYSTEM "file:///private/secret"><testsuites/>',
    report('<testcase name="one"><failure></testcase>'),
    report('<testcase name="one" name="two"/>'),
  ])("rejects malformed XML, declarations, and ambiguous roots: %s", (xml) => {
    expect(() => validateJUnitReport(xml, [FILE])).toThrow();
  });

  test.each([
    "<testsuites/>",
    report(""),
    report("<testcase/>"),
    report('<testcase name="  "/>'),
    report("<unexpected/>"),
  ])("rejects empty and unnamed records: %s", (xml) => {
    expect(() => validateJUnitReport(xml, [FILE])).toThrow();
  });

  test.each(["-1", "1.5", "NaN", "Infinity", "1e0", "", "9007199254740992"])(
    "rejects invalid integer count %s",
    (value) => {
      for (const field of ["tests", "assertions", "failures", "errors", "skipped"]) {
        expect(() => validateJUnitReport(report(CASE, `${field}="${value}"`), [FILE])).toThrow(
          "count",
        );
      }
      expect(() =>
        validateJUnitReport(report(`<testcase name="one" assertions="${value}"/>`), [FILE]),
      ).toThrow("count");
    },
  );

  test.each(['tests="2"', 'assertions="3"', 'failures="1"', 'errors="1"', 'skipped="1"'])(
    "rejects contradictory nested totals: %s",
    (attribute) => {
      expect(() =>
        validateJUnitReport(report(`<testsuite ${attribute}>${CASE}</testsuite>`), [FILE]),
      ).toThrow("Contradictory");
      expect(() =>
        validateJUnitReport(report(CASE).replace("<testsuites>", `<testsuites ${attribute}>`), [
          FILE,
        ]),
      ).toThrow("Contradictory");
    },
  );

  test.each(["-0.1", "NaN", "Infinity", "1e999", ""])("rejects invalid durations %s", (value) => {
    expect(() => validateJUnitReport(report(CASE, `time="${value}"`), [FILE])).toThrow("duration");
    expect(() =>
      validateJUnitReport(report(`<testcase name="one" time="${value}"/>`), [FILE]),
    ).toThrow("duration");
  });

  test("requires actual testcase file identities rather than trusting suite labels", () => {
    const another = "test/another.unit.test.ts";
    const xml = report(`<testcase name="one" file="${another}"/>`);
    expect(() => validateJUnitReport(xml, [FILE, another])).toThrow(`missing [${FILE}]`);
    expect(() => validateJUnitReport(xml, [FILE])).toThrow(`unexpected [${another}]`);
    expect(validateJUnitReport(xml, [another]).files).toEqual([another]);
    expect(() =>
      validateJUnitReport('<testsuite><testcase name="one"/></testsuite>', [FILE]),
    ).toThrow("no file identity");
    expect(() => validateJUnitReport(report(CASE), [])).toThrow("empty selection");
    expect(() => validateJUnitReport(report(CASE), [FILE, FILE])).toThrow("Duplicate");
  });

  test("preserves failure and error counts independently from the passing gate", () => {
    const xml = report(
      '<testcase name="failure"><failure message="failed">stack</failure></testcase><testcase name="error"><error message="setup">stack</error></testcase>',
      'tests="2" assertions="0" failures="1" errors="1" skipped="0"',
    );
    const summary = validateJUnitReport(xml, [FILE]);
    expect(summary).toMatchObject({ tests: 2, failures: 1, errors: 1, skipped: 0 });
    expect(() => assertJUnitPassed(summary)).toThrow("1 failures, 1 errors");
  });

  test("detects Bun skip and TODO elements even when the process exits successfully", () => {
    // Bun 1.4.1 emits both records into the declared skipped total.
    const xml = report(
      `${CASE}<testcase name="skip" assertions="0"><skipped /></testcase><testcase name="todo" assertions="0"><skipped message="TODO" /></testcase>`,
      'tests="3" assertions="2" skipped="2" failures="0"',
    );
    const summary = validateJUnitReport(xml, [FILE]);
    expect(summary).toMatchObject({ tests: 3, skipped: 2 });
    expect(() => assertJUnitPassed(summary)).toThrow("2 skipped/TODO");
    expect(() => validateJUnitReport(xml.replace('skipped="2"', 'skipped="0"'), [FILE])).toThrow(
      "Contradictory",
    );
  });

  test.each([
    'skip="true"',
    'skipped="1"',
    'todo="true"',
    'disabled="true"',
    'status="skipped"',
    'status="todo"',
    'status="notrun"',
    'status="disabled"',
  ])("detects alternate skipped/TODO attributes: %s", (attribute) => {
    const summary = validateJUnitReport(report(`${CASE}<testcase name="skip" ${attribute}/>`), [
      FILE,
    ]);
    expect(summary.skipped).toBe(1);
    expect(() => assertJUnitPassed(summary)).toThrow("skipped/TODO");
  });

  test("rejects no executed cases and incompatible outcome records", () => {
    expect(() =>
      validateJUnitReport(report('<testcase name="skip"><skipped/></testcase>'), [FILE]),
    ).toThrow("no executed");
    for (const content of [
      "<skipped/><failure/>",
      "<failure/><error/>",
      "<failure/><failure/>",
      "<todo/><skipped/>",
    ]) {
      expect(() =>
        validateJUnitReport(report(`<testcase name="case">${content}</testcase>`), [FILE]),
      ).toThrow();
    }
    for (const attributes of [
      'status="failed"',
      'status="error"',
      'status="unknown"',
      'todo="maybe"',
    ]) {
      expect(() =>
        validateJUnitReport(report(`<testcase name="case" ${attributes}/>`), [FILE]),
      ).toThrow();
    }
    expect(() =>
      validateJUnitReport(report('<testcase name="case" status="passed"><failure/></testcase>'), [
        FILE,
      ]),
    ).toThrow("Contradictory");
  });

  test("rejects outcome records hidden in metadata and contradictory testcase attributes", () => {
    for (const metadata of ["properties", "system-out", "system-err"]) {
      expect(() =>
        validateJUnitReport(report(`${CASE}<${metadata}><testcase name="hidden"/></${metadata}>`), [
          FILE,
        ]),
      ).toThrow("Misplaced");
      expect(() =>
        validateJUnitReport(
          report(`<testcase name="one"><${metadata}><skipped/></${metadata}></testcase>`),
          [FILE],
        ),
      ).toThrow("Misplaced");
    }
    expect(() =>
      validateJUnitReport(
        report('<testcase name="one"><failure><testcase name="hidden"/></failure></testcase>'),
        [FILE],
      ),
    ).toThrow("Misplaced");
    for (const attribute of ['failures="1"', 'errors="1"', 'tests="0"', 'tests="2"']) {
      expect(() =>
        validateJUnitReport(report(`<testcase name="one" ${attribute}/>`), [FILE]),
      ).toThrow("Contradictory testcase");
    }
  });
});
