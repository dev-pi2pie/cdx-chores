import { expect, test } from "bun:test";
import { resolveStyledTitle } from "../../../src/cli/markdown-pdf/title/styled-title";

const header = '<header class="document-title"><h1>Report</h1></header>';
const body =
  '<h1 id="earlier" style="display:none">Earlier</h1><h1 id="report">Re<em>port</em></h1>';
const html = '<main class="document-body">' + header + body + "</main>";
const headings = [
  { id: "earlier", matches: false, text: "Earlier" },
  { id: "report", matches: true, text: "Report" },
];
const input = { html, customStyle: true, inlineMatch: true, headings };

test("the substitution changes only the matching heading text, preserving emphasis and source order", async () => {
  const result = await resolveStyledTitle({
    ...input,
    inspect: async (original, candidates) => {
      expect(original).toBe(html.replace(header, ""));
      expect(candidates).toHaveLength(1);
      const candidate = candidates[0]!;
      expect(candidate.earlierIds).toEqual(["earlier"]);
      expect(candidate.id).toBe("report");
      expect(candidate.text).toBe("Report");
      expect(candidate.substitute).toBe("eRtrop");
      expect(candidate.html).toBe(original.replace("Re<em>port</em>", "eR<em>trop</em>"));
      return { sourceId: candidate.id, complete: true };
    },
  });
  expect(result).toBe(html.replace(header, ""));
});

test.each([
  ["missing source identity", { complete: true }],
  ["known identity without visibility evidence", { sourceId: "report" }],
  ["incomplete printed text", { sourceId: "report", complete: false }],
  ["unmatched earlier heading", { sourceId: "earlier", complete: true }],
])("retains metadata for %s", async (_reason, evidence) => {
  expect(await resolveStyledTitle({ ...input, inspect: async () => evidence })).toBe(html);
});

test("a duplicate source ID cannot authorize omission", async () => {
  const duplicate = html.replace('id="earlier"', 'id="report"');
  expect(
    await resolveStyledTitle({
      ...input,
      html: duplicate,
      inspect: async () => {
        throw new Error("unexpected proof");
      },
    }),
  ).toBe(duplicate);
});

test("a one-character heading has a distinct substitute", async () => {
  const single = html.replace(body, '<h1 id="report">X</h1>');
  await resolveStyledTitle({
    ...input,
    html: single,
    headings: [{ id: "report", matches: true, text: "X" }],
    inspect: async (_, candidates) => {
      expect(candidates[0]!.substitute).not.toBe("X");
      return {};
    },
  });
});

test("an inert style example keeps the ordinary title comparison", async () => {
  const example = html + "<code>&lt;style&gt;</code>";
  expect(
    await resolveStyledTitle({
      ...input,
      html: example,
      customStyle: false,
      inspect: async () => {
        throw new Error("unexpected proof");
      },
    }),
  ).toBe(example.replace(header, ""));
});

test("an embedded stylesheet uses print evidence", async () => {
  const styled = "<style>#report { display:none }</style>" + html;
  expect(
    await resolveStyledTitle({
      ...input,
      html: styled,
      customStyle: false,
      inspect: async () => ({}),
    }),
  ).toBe(styled);
});
