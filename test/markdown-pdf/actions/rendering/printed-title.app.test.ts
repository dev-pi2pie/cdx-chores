import { expect, spyOn, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
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
  "complete",
  "unchanged substitution",
  "clipped",
  "malformed proof",
  "unavailable canvas",
] as const)("publishes the selected HTML and final PDF with %s evidence", async (condition) => {
  await withTempFixtureDir("styled-auto-render", async (dir) => {
    const input = join(dir, "title.md"),
      css = join(dir, "author.css");
    const output = join(dir, "title.pdf"),
      htmlOutput = join(dir, "title.html");
    await writeFile(input, "---\ntitle: Report\n---\n\n# Report {#report}\n");
    await writeFile(css, "#report {letter-spacing: .25em}");
    const header = '<header class="document-title"><h1>Report</h1></header>';
    const body = '<h1 id="report">Report</h1>';
    const { runner } = createPdfRunner({
      html: '<main class="document-body">' + header + body + "</main>",
      pandocJson: pandocTitleJson("Report", "Report", "report"),
    });
    const { runtime } = createActionTestRuntime({ cwd: dir });
    const proofHtml: string[] = [];
    const finalHtml: string[] = [];
    const finalPdf = taggedTitlePdf(["Final"], "clear");
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
          if (!args.includes("--pdf-variant")) {
            finalHtml.push(html);
            await writeFile(pdf, finalPdf);
            return ok();
          }
          proofHtml.push(html);
          const alternate = html.includes(">tropeR</h1>");
          const text = alternate && condition !== "unchanged substitution" ? "tropeR" : "Report";
          await writeFile(
            pdf,
            condition === "malformed proof"
              ? "invalid PDF"
              : taggedTitlePdf([text], condition === "clipped" ? "clipped" : "clear"),
          );
          if (alternate && condition === "unavailable canvas" && outlines) {
            const canvas = pdfRequire("@napi-rs/canvas");
            const unavailable = spyOn(canvas, "createCanvas").mockImplementation(() => {
              attemptedCanvas = true;
              throw Error("Optional canvas failed to initialize");
            });
            restoreBackend = () => unavailable.mockRestore();
          }
          return ok();
        },
      });
    } finally {
      restoreBackend?.();
    }
    expect(proofHtml[0]).toContain(body);
    if (outlines && condition === "unavailable canvas") expect(attemptedCanvas).toBe(true);
    expect(proofHtml[0]).not.toContain(header);
    if (outlines && condition !== "malformed proof") expect(proofHtml[1]).toContain(">tropeR</h1>");
    if (condition === "malformed proof") expect(proofHtml).toHaveLength(1);
    expect(finalHtml).toHaveLength(1);
    expect(finalHtml[0]).toContain(body);
    expect(finalHtml[0]!.includes(header)).toBe(condition !== "complete" || !outlines);
    expect(await readFile(htmlOutput, "utf8")).toBe(finalHtml[0]!);
    expect((await readFile(output)).equals(finalPdf)).toBe(true);
  });
});
