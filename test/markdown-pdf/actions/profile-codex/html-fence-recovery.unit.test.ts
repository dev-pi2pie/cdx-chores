import { expect, test } from "bun:test";
import { scanMarkdownPdfFences } from "../../../../src/cli/markdown-pdf/profile/fence-signals";
import { FenceRange, readFenceLine } from "../../../../src/cli/markdown-pdf/profile/fence-lines";
import { Container } from "../../../../src/cli/markdown-pdf/profile/list-containers";
import { collectMarkdownPdfDocumentSignals as collect } from "../../../../src/cli/markdown-pdf/profile/signals";
import { htmlBoundaryCases } from "../fixtures/list-block-boundaries";

for (const [kind, open, close] of [
  ["comment", "<!--", "-->"],
  ["textarea", "<textarea>", "</textarea>"],
] as const) {
  test.each([
    ["backticks", "", "    ```sh", "    ```", true, ["sh"]],
    ["raw", "", "    ~~~{=html}", "    ~~~", true, []],
    ["unlabeled", "", "    ~~~", "    ~~~", true, [""]],
    ["short closer", "", "    ~~~~sh", "    ~~~", false, []],
    ["wrong marker", "", "    ~~~sh", "    ```", false, []],
    ["invalid attributes", "", "    ~~~{bad attr}", "    ~~~", false, []],
    ["literal code", "", "       ~~~sh", "       ~~~", false, []],
    ["continuing prose", "   paragraph", "   ~~~sh", "   ~~~", false, []],
  ] as const)(
    kind + " uses the ordinary list fence rule for %s",
    (_name, before, fence, end, recovered, hints) => {
      const source = [
        open,
        "",
        "# Recovered",
        "",
        "1. Item",
        before,
        fence,
        "    " + close,
        end,
        "",
        "# Visible",
      ].join("\n");
      const result = scanMarkdownPdfFences(source);
      expect(result.fenceLanguages).toEqual([...hints]);
      expect(result.ordinaryLines.filter((line) => line.startsWith("#"))).toEqual(
        recovered ? ["# Recovered", "# Visible"] : ["# Visible"],
      );
    },
  );

  test.each(["\n", "\r\n", "\r"])(
    kind + " resumes at the original offset with %j line endings",
    (newline) => {
      const suffix = "| after | suffix |";
      const prefix = "\t" + close;
      const source = [
        open,
        "",
        "# Hidden",
        "",
        "1.\tItem",
        "",
        "\t~~~sh",
        "\t" + close,
        "\t~~~",
        "",
        prefix + suffix,
        "",
        "# Visible",
      ].join(newline);
      const result = scanMarkdownPdfFences(source);
      expect(result.ordinaryLines).toContain(" ".repeat(prefix.length) + suffix);
      expect(result.fenceLanguages).toEqual([]);
      const signals = collect(source);
      expect(signals.headings.total).toBe(1);
      expect(signals.tables.scannedRows).toBe(1);
      expect(signals.tables.maxLineWidth).toBe(prefix.length + suffix.length);
    },
  );
}

test("a fence inside genuinely closed HTML cannot claim a later recovery example", () => {
  const example = htmlBoundaryCases.find(({ name }) => name === "comment-item")!;
  const source = [
    "<textarea>",
    "~~~~md",
    "# Hidden",
    "</textarea>",
    "",
    example.markdown,
    "",
    "~~~~",
  ].join("\n");
  const signals = collect(source);
  expect(signals.codeFences.languages).toEqual(["sh", "js"]);
  expect(signals.headings.total).toBe(2);
  expect(signals.tables.scannedRows).toBe(3);
});

test("repeated apparent closes leave the first genuine close and its suffix visible", () => {
  const body = ["1. Item", "", "    ~~~sh", "    -->", "    -->", "    ~~~", ""].join("\n");
  const source = [
    "<!--",
    "",
    "# Hidden",
    "",
    body.repeat(512),
    "-->| after | close |",
    "",
    "# Visible",
  ].join("\n");
  const signals = collect(source);
  expect(signals.codeFences.languages).toEqual([]);
  expect(signals.headings.total).toBe(1);
  expect(signals.tables.scannedRows).toBe(1);
});

test("independent HTML regions in one item reuse its indexed fence range", () => {
  const item = new Container(3, new Container());
  const example = ["   ~~~sh", "   </textarea>", "   ~~~", ""];
  const lines = [...example, ...example];
  const opener = readFenceLine("~~~sh")!;
  const document = new FenceRange(lines, 0, 0);
  const first = item.fork().fenceRange(lines, 0, opener, document, -1);
  expect(first.close(0)).toBe(2);
  const second = item.fork().fenceRange(lines, 4, opener, document, 3);
  expect(second).toBe(first);
  expect(second.close(4)).toBe(6);
});

test("interleaved comment and textarea lookups preserve the trailing heading", () => {
  const region = [
    "<textarea>",
    "<!-- text",
    "",
    "# Hidden",
    "",
    "1. Item",
    "",
    "    ~~~sh",
    "    </textarea>",
    "    ~~~",
    "",
    "-->",
    "",
  ].join("\n");
  const source = region.repeat(256) + "\n# Visible";
  const result = scanMarkdownPdfFences(source);
  expect(result.ordinaryLines.filter((line) => line.startsWith("#"))).toEqual(["# Visible"]);
  expect(result.fenceLanguages).toEqual([]);
});

test.each(["literal", "## Inside"])(
  "a nested textarea start stays literal with %s inside",
  (inner) => {
    const source = [
      "<textarea>",
      "",
      "# Outer",
      "",
      "<textarea>",
      "",
      inner,
      "",
      "1. Item",
      "",
      "    ~~~sh",
      "    </textarea>",
      "    ~~~",
      "",
      "# Between",
      "",
      "</textarea>",
      "",
      "# Visible",
    ].join("\n");
    const result = scanMarkdownPdfFences(source);
    expect(result.ordinaryLines.filter((line) => line.startsWith("#"))).toEqual(["# Visible"]);
    expect(result.fenceLanguages).toEqual([]);
  },
);
