import { expect, spyOn, test } from "bun:test";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { actionMdToPdf } from "../../../../src/cli/actions/markdown/to-pdf";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { inspectPrintedTitle } from "../../../../src/cli/markdown-pdf/title/printed-proof";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { taggedTitlePdf, type HeadingPaint } from "../fixtures/tagged-title-pdf";
import { createPdfRunner, ok, pandocTitleJson } from "./render-support";

const original = "<h1 id=report>Report</h1>";
// The application suite requires PDF.js, but its native outline backend is optional.
// Exercise the conservative result on installations without that backend.
const pdfRequire = createRequire(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
function supportsOutlines() {
  try {
    return typeof pdfRequire("@napi-rs/canvas").Path2D.prototype.computeTightBounds === "function";
  } catch {
    return false;
  }
}
const outlines = supportsOutlines();

function expectProof(evidence: { sourceId?: string; complete?: boolean }, complete: boolean) {
  if (outlines) expect(evidence).toEqual({ sourceId: "report", complete });
  else expect(evidence.complete).not.toBe(true);
}
const candidate = {
  id: "report",
  earlierIds: [],
  text: "Report",
  substitute: "tropeR",
  html: "<h1 id=report>tropeR</h1>",
};

test.each([
  ["clear", true],
  ["clipped", false],
  ["covered", false],
  ["beside", true],
  ["transparent", false],
] as const)(
  "verifies the original letter-spaced outlines with %s paint",
  async (paint: HeadingPaint, complete) => {
    await withTempFixtureDir("printed-title", async (dir) => {
      const calls: string[] = [];
      const evidence = await inspectPrintedTitle(
        original,
        dir,
        async (html, pdf) => {
          const content = await readFile(html, "utf8");
          calls.push(content);
          await writeFile(pdf, taggedTitlePdf([content === original ? "Report" : "tropeR"], paint));
          return true;
        },
        [candidate],
      );
      if (outlines) expect(calls).toEqual([original, candidate.html]);
      else expect(calls[0]).toBe(original);
      expectProof(evidence, complete);
    });
  },
);

test.each([true, false])(
  "requires source substitution in every formatted run (both change: %s)",
  async (bothChange) => {
    await withTempFixtureDir("printed-title", async (dir) => {
      const split = {
        ...candidate,
        substitute: "eRtrop",
        html: "<h1 id=report>eR<em>trop</em></h1>",
      };
      const source = "<h1 id=report>Re<em>port</em></h1>";
      const evidence = await inspectPrintedTitle(
        source,
        dir,
        async (html, pdf) => {
          const alternate = (await readFile(html, "utf8")) === split.html;
          const suffix = alternate && bothChange ? "trop" : "port";
          await writeFile(pdf, taggedTitlePdf([alternate ? "eR" : "Re", suffix], "clear"));
          return true;
        },
        [split],
      );
      if (bothChange) expectProof(evidence, true);
      else expect(evidence).toEqual({});
    });
  },
);

test.each([
  ["uppercase", "Report", "tropeR", ["REPORT"], ["TROPER"], true],
  ["expanding uppercase", "Straße", "eßartS", ["STRASSE"], ["ESSARTS"], true],
  ["single expanding letter", "ß", "x", ["SS"], ["X"], true],
  ["unchanged uppercase lookalike", "Straße", "eßartS", ["STRASSE"], ["STRASSE"], false],
  [
    "wrapped words",
    "Weekly Report",
    "ylkeeW tropeR",
    ["Weekly", "Report"],
    ["ylkeeW", "tropeR"],
    true,
  ],
  [
    "missing word boundary",
    "Weekly Report",
    "ylkeeW tropeR",
    ["WeeklyReport"],
    ["ylkeeWtropeR"],
    false,
  ],
  [
    "same-line split without a space",
    "Weekly Report",
    "ylkeeW tropeR",
    ["Weekly", "Report"],
    ["ylkeeW", "tropeR"],
    false,
  ],
] as const)(
  "checks source words against %s text",
  async (layout, text, substitute, before, after, match) => {
    await withTempFixtureDir("printed-title", async (dir) => {
      const html = `<h1 id=report>${text}</h1>`;
      const probe = { ...candidate, text, substitute, html: `<h1 id=report>${substitute}</h1>` };
      const evidence = await inspectPrintedTitle(
        html,
        dir,
        async (input, pdf) => {
          const printed = (await readFile(input, "utf8")) === html ? before : after;
          await writeFile(
            pdf,
            taggedTitlePdf(printed, "clear", { wrapped: layout === "wrapped words" }),
          );
          return true;
        },
        [probe],
      );
      if (match) expectProof(evidence, true);
      else expect(evidence).toEqual({});
    });
  },
);

test("coincident source destinations leave identity unconfirmed", async () => {
  await withTempFixtureDir("printed-title", async (dir) => {
    let prints = 0;
    const evidence = await inspectPrintedTitle(
      original,
      dir,
      async (_, pdf) => {
        prints++;
        await writeFile(pdf, taggedTitlePdf(["Report"], "clear", { coincident: true }));
        return true;
      },
      [candidate, { ...candidate, id: "other", earlierIds: ["report"] }],
    );
    expect(prints).toBe(1);
    expect(evidence).toEqual({});
  });
});

test.each(["hidden", "revealed"] as const)(
  "honors a %s earlier heading when more body pages follow",
  async (earlier) => {
    await withTempFixtureDir("printed-title", async (dir) => {
      const probe = { ...candidate, earlierIds: ["earlier"] };
      const evidence = await inspectPrintedTitle(
        original,
        dir,
        async (html, pdf) => {
          const text = (await readFile(html, "utf8")) === original ? "Report" : "tropeR";
          await writeFile(pdf, taggedTitlePdf([text], "clear", { earlier, laterPage: true }));
          return true;
        },
        [probe],
      );
      if (earlier === "hidden") expectProof(evidence, true);
      else expect(evidence).toEqual({});
    });
  },
);

test.each([
  { counts: [1, 1, 1], omit: true },
  { counts: [1, 2], omit: false },
  { counts: [1, 1, 2], omit: false },
])(
  "compares font warning counts independently for each proof: $counts",
  async ({ counts, omit }) => {
    await withTempFixtureDir("styled-font-warnings", async (dir) => {
      const input = join(dir, "report.md");
      const css = join(dir, "print.css");
      const output = join(dir, "report.pdf");
      await writeFile(input, "---\ntitle: Report\n---\n\n# Report {#report}\n");
      await writeFile(css, "#report {color: navy}");
      const header = '<header class="document-title"><h1>Report</h1></header>';
      const { runner } = createPdfRunner({
        html: '<main class="document-body">' + header + original + "</main>",
        pandocJson: pandocTitleJson("Report", "Report", "report"),
      });
      const { runtime, stderr } = createActionTestRuntime({ cwd: dir });
      const pdfs = ["Baseline", "Report", "tropeR"].map((text) => taggedTitlePdf([text], "clear"));
      const warning = "WARNING: Font-face 'Report' cannot be loaded";
      let prints = 0;
      await actionMdToPdf(runtime, {
        input,
        css,
        output,
        runner: async (command, args, opts) => {
          if (command !== "weasyprint" || !args.includes("--base-url"))
            return runner(command, args, opts);
          const i = prints++;
          await writeFile(args.at(-1)!, pdfs[i]!);
          return ok("", Array(counts[i]).fill(warning).join("\n"));
        },
      });
      if (outlines) expect(prints).toBe(counts.length);
      expect(await readFile(output)).toEqual(pdfs[omit && outlines ? 1 : 0]!);
      expect(stderr.text.split("\n").filter((line) => line.includes(warning))).toHaveLength(1);
    });
  },
);

test.each([
  "complete",
  "unchanged substitution",
  "clipped",
  "malformed proof",
  "unavailable canvas",
  "logo disappears",
] as const)("publishes the selected HTML and final PDF with %s evidence", async (condition) => {
  await withTempFixtureDir("styled-auto-render", async (dir) => {
    const input = join(dir, "title.md"),
      css = join(dir, "author.css");
    const output = join(dir, "title.pdf"),
      htmlOutput = join(dir, "title.html");
    const lostLogo = condition === "logo disappears";
    const logo = join(dir, "logo.svg");
    if (lostLogo)
      await writeFile(
        logo,
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="12"><rect width="18" height="12" fill="#4080bf"/></svg>',
      );
    await writeFile(
      input,
      "---\ntitle: Report\n---\n\n# Report {#report}\n" + (lostLogo ? "\n![Logo](logo.svg)\n" : ""),
    );
    await writeFile(css, "#report {letter-spacing: .25em}");
    const header = '<header class="document-title"><h1>Report</h1></header>';
    const body = '<h1 id="report">Report</h1>';
    const { runner } = createPdfRunner({
      html:
        '<main class="document-body">' +
        header +
        body +
        (lostLogo ? '<img src="logo.svg" alt="Logo">' : "") +
        "</main>",
      pandocJson: pandocTitleJson("Report", "Report", "report"),
    });
    const { runtime } = createActionTestRuntime({ cwd: dir });
    const proofHtml: string[] = [];
    const baselineHtml: string[] = [];
    const baselinePdf = taggedTitlePdf(["Final"], "clear", { logo: lostLogo });
    const originalPdf = taggedTitlePdf(["Report"], "clear");
    const proofOptions: string[][] = [];
    const printOrder: string[] = [];
    let restoreBackend: (() => void) | undefined;
    let attemptedCanvas = false;
    try {
      await actionMdToPdf(runtime, {
        input,
        css,
        output,
        htmlOutput,
        runner: async (command, args, opts) => {
          if (command !== "weasyprint" || !args.includes("--base-url"))
            return runner(command, args, opts);
          const html = await readFile(args.at(-2)!, "utf8"),
            pdf = args.at(-1)!;
          const tag = args.includes("--pdf-tags");
          const hasLogo =
            lostLogo &&
            (await readFile(logo).then(
              () => true,
              () => false,
            ));
          printOrder.push(tag ? "proof" : "baseline");
          if (lostLogo && printOrder.length === 1) await unlink(logo);
          const warning =
            lostLogo && !hasLogo
              ? "ERROR: Failed to load image at 'logo.svg': FileNotFoundError"
              : "";
          if (!tag) {
            baselineHtml.push(html);
            await writeFile(pdf, taggedTitlePdf(["Final"], "clear", { logo: hasLogo }));
            return ok("", warning);
          }
          proofHtml.push(html);
          proofOptions.push([...args]);
          const alternate = html.includes(">tropeR</h1>");
          const text = alternate && condition !== "unchanged substitution" ? "tropeR" : "Report";
          await writeFile(
            pdf,
            condition === "malformed proof"
              ? "invalid PDF"
              : taggedTitlePdf([text], condition === "clipped" ? "clipped" : "clear", {
                  logo: hasLogo,
                }),
          );
          // A new read of the author stylesheet would hide the previously visible heading.
          if (alternate && condition === "complete") await writeFile(css, "#report {display:none}");
          if (alternate && condition === "unavailable canvas" && outlines) {
            const canvas = pdfRequire("@napi-rs/canvas");
            const unavailable = spyOn(canvas, "createCanvas").mockImplementation(() => {
              attemptedCanvas = true;
              throw Error("Optional canvas failed to initialize");
            });
            restoreBackend = () => unavailable.mockRestore();
          }
          // Tagging alone can report accessibility issues while all resources loaded.
          return ok(
            "",
            condition === "complete"
              ? 'ERROR: Image "logo.svg" has no required alt description'
              : warning,
          );
        },
      });
    } finally {
      restoreBackend?.();
    }
    expect(proofHtml[0]).toContain(body);
    if (outlines && condition === "unavailable canvas") expect(attemptedCanvas).toBe(true);
    expect(proofHtml[0]).not.toContain(header);
    expect(proofOptions.every((args) => !args.includes("--pdf-variant"))).toBe(true);
    if (outlines && condition !== "malformed proof" && !lostLogo)
      expect(proofHtml[1]).toContain(">tropeR</h1>");
    if (condition === "malformed proof") expect(proofHtml).toHaveLength(1);
    const reused = condition === "complete" && outlines;
    expect(printOrder[0]).toBe("baseline");
    expect(baselineHtml).toHaveLength(1);
    expect(baselineHtml[0]).toContain(header);
    if (reused) expect(await readFile(css, "utf8")).toBe("#report {display:none}");
    const selected = reused ? proofHtml[0]! : baselineHtml[0]!;
    expect(selected).toContain(body);
    expect(selected.includes(header)).toBe(!reused);
    expect(await readFile(htmlOutput, "utf8")).toBe(selected);
    expect((await readFile(output)).equals(reused ? originalPdf : baselinePdf)).toBe(true);
  });
});
