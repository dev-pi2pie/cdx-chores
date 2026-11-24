import { describe, expect, test } from "bun:test";

import { shouldSuppressMarkdownPdfMetadataTitle } from "../../../src/cli/markdown-pdf/ast-title";

const attr = ["", [], []];
const space = { t: "Space" };
const str = (text: string) => ({ t: "Str", c: text });
const header = (level: number, ...inlines: unknown[]) => ({
  t: "Header",
  c: [level, attr, inlines],
});
const div = (...blocks: unknown[]) => ({ t: "Div", c: [attr, blocks] });
const link = (destination: string, ...label: unknown[]) => ({
  t: "Link",
  c: [attr, label, [destination, ""]],
});
const meta = (...inlines: unknown[]) => ({ t: "MetaInlines", c: inlines });
const document = (title: unknown, ...blocks: unknown[]) => ({ meta: { title }, blocks });

const guide = str("Guide");

describe("Pandoc AST title comparison", () => {
  test("uses the first H1 at the top level or in a native Div", () => {
    const ast = document(
      meta(guide),
      { t: "RawBlock", c: ["html", "<h1>Raw heading</h1>"] },
      { t: "CodeBlock", c: [attr, "# Hidden heading"] },
      header(2, str("Preface")),
      div(div(header(1, guide))),
      header(1, str("Later")),
    );
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide")).toBe(true);
  });

  test.each([
    { t: "BlockQuote", c: [div(header(1, str("Aside")))] },
    { t: "BulletList", c: [[header(1, str("Aside"))]] },
    { t: "OrderedList", c: [[1, { t: "Decimal" }, { t: "Period" }], [[header(1, str("Aside"))]]] },
    { t: "Table", c: [[[[header(1, str("Aside"))]]]] },
    { t: "Para", c: [str("Note"), { t: "Note", c: [header(1, str("Aside"))] }] },
  ])("skips headings in $t", (container) => {
    const ast = document(meta(guide), container, header(1, guide));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide")).toBe(true);
    expect(shouldSuppressMarkdownPdfMetadataTitle(document(meta(guide), container), "Guide")).toBe(
      false,
    );
  });

  test.each([
    ["display: NONE /* comment */ !important; display: block", true],
    ["DISPLAY: none /* comment */ !IMPORTANT; display: block", false],
    ["display: none; display: block 'extra'", false],
    ["display: none; display: var(--layout); --layout: block", true],
    ["display: none; display: block", true],
    ["display:var(--missing,) none", false],
    ["--layout:; display:var(--layout,none)", false],
    ["--layout:var(--missing,); display:var(--layout,none)", false],
    ["display:none var(--missing,)", false],
    ["display:none;display:var(--missing,) block", true],
    ["visibility:var(--missing, ) hidden", false],
    ["display: none; --layout:bogus; display:var(--layout)", true],
    ["display: none; --layout:12px; display:var(--layout, none)", true],
    ["display: none; display:foo-var(--layout)", false],
    ["visibility:hidden; --show:bogus; visibility:var(--show)", true],
    ["display: block !important; display: none", true],
    ['--label: ";display:none;"; color: black', true],
    ["color: red", true],
  ] as const)("resolves inline visibility for both Div and Header: %s", (style, suppress) => {
    const attrs = ["", [], [["style", style]]];
    for (const block of [
      { t: "Div", c: [attrs, [div(header(1, guide))]] },
      { t: "Header", c: [1, attrs, [guide]] },
    ]) {
      expect(shouldSuppressMarkdownPdfMetadataTitle(document(meta(guide), block), "Guide")).toBe(
        suppress,
      );
    }
  });

  test.each([
    ["visibility:hidden", "color:red", false],
    ["--layout:none", "display:var(--layout)", false],
    ["display:table-column", "display:block;visibility:visible", false],
    ["display:table-column-group", "display:table-cell", false],
    ["display:table-column;display:table-cell", "display:block", true],
    ["display:table-row", "display:table-cell", true],
    ["display:table-column;float:right", "color:red", true],
    ["display:table-column;float:left;float:none", "color:red", false],
    ["display:table-column;float:none!important;float:left", "color:red", false],
    ["display:table-column;position:relative", "color:red", false],
    ["display:table-column;float:left;position:running(Heading)", "display:block", false],
    ["position:running(章節)", "color:red", false],
    ["position:note(Heading)", "color:red", false],
    ["position:running(Heading);position:static", "color:red", true],
    ["position:running(123)", "color:red", true],
    [String.raw`position:running(\31 23)`, "color:red", false],
    ['position:running("Heading")', "color:red", true],
    ["display:table-column;position:absolute;position:RUNNING(example)", "color:red", true],
    ["position:fixed", "display:table-column;position:inherit", true],
    ["float:right", "display:table-column;float:inherit", true],
    ["position:fixed", "display:table-column", false],
    ["--layout:absolute", "display:table-column;position:var(--layout)", true],
    ["display:none;position:absolute;float:left", "color:red", false],
    ["--a:none;--b:block;--layout:var(--a,var(--b))", "display:var(--layout,block)", false],
    ["--b:block;--layout:var(--a,var(--b))", "display:var(--layout,none)", true],
    ["--layout:var(--external)", "display:var(--layout,block)", false],
    ["--layout:var(--layout)", "display:var(--layout,block)", false],
    ["--layout:inline; --outer:var(--layout)", "--layout:none;display:var(--outer)", true],
    ["--Layout:block; --Layout:none!important; --Layout:inline", "display:var(--Layout)", false],
    ["--layout:block", "display:var(--layout) flow-root", true],
    ["color:red", "DISPLAY:var(--missing, block)", true],
    ["color:red", "visibility:var(--external)", false],
    ["display:var(--external)", "display:block", false],
    ["color:red", "visibility:HIDDEN", false],
    ["visibility:hidden", "visibility:visible", true],
    ["visibility:hidden", "visibility:inherit", false],
    ["visibility:collapse", "visibility:initial", true],
    ["display:none", "display:block; visibility:visible", false],
    ["display:none; display:bogus", "visibility:visible", false],
    ["--value:fn(x;display:none;); color:red", "color:red", true],
  ] as const)("resolves %s on the parent and %s on the H1", (parent, child, suppress) => {
    const attrs = (style: string) => ["", [], [["style", style]]];
    const node = { t: "Div", c: [attrs(parent), [{ t: "Header", c: [1, attrs(child), [guide]] }]] };
    expect(shouldSuppressMarkdownPdfMetadataTitle(document(meta(guide), node), "Guide")).toBe(
      suppress,
    );
  });

  test.each([
    ["flow-root block", true],
    ["block flow-root list-item", true],
    ["block list-item flow-root", true],
    ["flow-root block list-item", true],
    ["flow-root list-item block", true],
    ["list-item block flow-root", true],
    ["list-item flow-root block", true],
    ["list-item inline", true],
    ["inline-grid", true],
    ["flow-root flow", false],
    ["inline block", false],
    ["list-item list-item", false],
    ["flex list-item", false],
    ["revert-layer", false],
    ["bogus", false],
  ] as const)("resolves a display override after display:none: %s", (display, suppress) => {
    const attrs = ["", [], [["style", `display:none; display:${display}`]]];
    const node = { t: "Div", c: [attrs, [header(1, guide)]] };
    expect(shouldSuppressMarkdownPdfMetadataTitle(document(meta(guide), node), "Guide")).toBe(
      suppress,
    );
  });

  test("continues past an explicitly hidden subtree", () => {
    const hidden = { t: "Div", c: [["", [], [["hidden", ""]]], [header(1, str("Earlier"))]] };
    expect(
      shouldSuppressMarkdownPdfMetadataTitle(
        document(meta(guide), hidden, header(1, guide)),
        "Guide",
      ),
    ).toBe(true);
  });

  test("stops at an earlier eligible H1", () => {
    const ast = document(meta(guide), header(1, str("Earlier")), div(header(1, guide)));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide")).toBe(false);
  });

  test("projects formatted text consistently across metadata and heading", () => {
    const ast = document(
      meta(
        { t: "Emph", c: [str("Build")] },
        { t: "SoftBreak" },
        { t: "Strong", c: [str("guide")] },
        { t: "LineBreak" },
        { t: "Quoted", c: [{ t: "DoubleQuote" }, [str("A")]] },
        space,
        { t: "Quoted", c: [{ t: "SingleQuote" }, [str("B")]] },
      ),
      header(1, str("build  guide “a” ‘b’")),
    );
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Build guide")).toBe(true);
  });

  test("supports a parsed MetaString", () => {
    const ast = document({ t: "MetaString", c: "   GUIDE  " }, header(1, guide));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "GUIDE")).toBe(true);
  });

  test("preserves literal punctuation in inline code", () => {
    const title = meta({ t: "Code", c: [attr, "build_task()"] });
    expect(
      shouldSuppressMarkdownPdfMetadataTitle(
        document(title, header(1, str("build_task()"))),
        "code",
      ),
    ).toBe(true);
    expect(
      shouldSuppressMarkdownPdfMetadataTitle(document(title, header(1, str("buildtask"))), "code"),
    ).toBe(false);
  });

  test("keeps meaningful punctuation in plain text", () => {
    const ast = document(meta(str("Guide (draft)")), header(1, str("Guide draft")));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide (draft)")).toBe(false);
  });

  test.each([
    { t: "Math", c: [{ t: "InlineMath" }, "x"] },
    { t: "Span", c: [attr, [guide]] },
    { t: "Image", c: [attr, [guide], ["figure.svg", ""]] },
    { t: "Quoted", c: [{ t: "UnknownQuote" }, [guide]] },
  ])("keeps the title when $t prevents a comparison", (unsupported) => {
    const ast = document(meta(guide), header(1, unsupported), header(1, guide));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide")).toBe(false);
    expect(
      shouldSuppressMarkdownPdfMetadataTitle(
        document(meta(unsupported), header(1, guide)),
        "Guide",
      ),
    ).toBe(false);
  });

  test("requires a nonempty string from front matter and a supported parsed title", () => {
    const ast = document(meta(guide), header(1, guide));
    for (const source of [null, undefined, 17, ["Guide"], "", " \t\n"]) {
      expect(shouldSuppressMarkdownPdfMetadataTitle(ast, source)).toBe(false);
    }
    expect(shouldSuppressMarkdownPdfMetadataTitle({ blocks: [header(1, guide)] }, "Guide")).toBe(
      false,
    );
    expect(shouldSuppressMarkdownPdfMetadataTitle(document(meta(), header(1)), "Guide")).toBe(
      false,
    );
  });

  test("keeps the title when the first eligible H1 has an unreadable inline array", () => {
    const ast = document(meta(guide), { t: "Header", c: [1, attr, null] }, header(1, guide));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide")).toBe(false);
  });

  test("matches a formatted label and its exact destination", () => {
    const title = meta(link("/Quickstart", { t: "Emph", c: [guide] }));
    const match = document(title, header(1, link("/Quickstart", str("guide"))));
    expect(shouldSuppressMarkdownPdfMetadataTitle(match, "Guide")).toBe(true);

    for (const heading of [header(1, guide), header(1, link("/quickstart", guide))]) {
      expect(shouldSuppressMarkdownPdfMetadataTitle(document(title, heading), "Guide")).toBe(false);
    }
  });

  test("requires the destination to stay paired with the same label", () => {
    const title = meta(link("/guide", str("Read the")), space, guide);
    const heading = header(1, link("/guide", str("Read the guide")));
    expect(shouldSuppressMarkdownPdfMetadataTitle(document(title, heading), "Read the guide")).toBe(
      false,
    );
  });

  test("requires every metadata link when the displayed text matches", () => {
    const title = meta(link("/guide", guide), space, link("/api", str("API")));
    const heading = header(1, link("/guide", guide), space, link("/reference", str("API")));
    expect(shouldSuppressMarkdownPdfMetadataTitle(document(title, heading), "Guide API")).toBe(
      false,
    );
  });

  test("allows a heading link when the metadata title has no link", () => {
    const ast = document(meta(guide), header(1, link("/guide", guide)));
    expect(shouldSuppressMarkdownPdfMetadataTitle(ast, "Guide")).toBe(true);
  });
});
