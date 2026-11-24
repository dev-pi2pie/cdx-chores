import { expect, test } from "bun:test";
import { resolveStyledTitle } from "../../../src/cli/markdown-pdf/title/styled-title";

const header = '<header class="document-title"><h1>Report</h1></header>';
const body =
  '<h1 id="earlier" style="display:none">Earlier</h1><h1 id="report">Re<em>port</em></h1>';
const html = '<main class="document-body">' + header + body + "</main>";
const headings = [
  { id: "earlier", matches: false },
  { id: "report", matches: true },
];

test.each([
  ["the stylesheet hides the matching heading", [], true],
  ["the entire matching heading prints", ["Report"], false],
  ["a hidden earlier heading leaves an empty tag", ["", "Report"], false],
  ["a stylesheet reveals the earlier heading", ["Earlier", "Report"], true],
  ["only part of the title prints", ["port"], true],
] as const)("%s", async (_label, visible, keep) => {
  const result = await resolveStyledTitle({
    html,
    headings,
    customStyle: true,
    inlineMatch: true,
    inspect: async (probe) => {
      expect(probe).toBe(html.replace(header, ""));
      return [...visible];
    },
  });
  expect(result).toBe(keep ? html : html.replace(header, ""));
});

test("an inert style example keeps the ordinary title comparison", async () => {
  const example = html + "<code>&lt;style&gt;</code>";
  expect(
    await resolveStyledTitle({
      html: example,
      headings,
      customStyle: false,
      inlineMatch: true,
      inspect: async () => {
        throw new Error("unexpected print");
      },
    }),
  ).toBe(example.replace(header, ""));
});

test("an embedded stylesheet uses print evidence", async () => {
  const styled = "<style>#report { display:none }</style>" + html;
  expect(
    await resolveStyledTitle({
      html: styled,
      headings,
      customStyle: false,
      inlineMatch: true,
      inspect: async () => [],
    }),
  ).toBe(styled);
});
