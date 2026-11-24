import { describe, expect, test } from "bun:test";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { actionMdToPdf } from "../../../../src/cli/actions/markdown/to-pdf";
import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  prepareMarkdownPdfRender,
} from "../../../../src/cli/actions/markdown/to-pdf-service";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf/render";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { createPdfRunner, failing, ok, pandocTitleJson } from "./render-support";

const markdown = "---\ntitle: Report\n---\n\n# Report\n";
const html = "<html><body><h1>Report</h1></body></html>";
const ast = pandocTitleJson("Report", "Report");
const customHtml = '<html><body><main class="document-body">$body$</main></body></html>';

function arg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

describe("Markdown PDF AST render execution", () => {
  test("reports a process failure if the prepared Markdown disappears", async () => {
    await withTempFixtureDir("md-pdf-ast-missing-input", async (dir) => {
      const input = join(dir, "report.md");
      await writeFile(input, markdown);
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { calls, runner } = createPdfRunner({ html });
      const prepared = await prepareMarkdownPdfRender(runtime, { input });
      const plan = await planMarkdownPdfRender(runtime, prepared, { output: "report.pdf" });
      await rm(input);

      await expect(
        executePlannedMarkdownPdfRender(runtime, plan, { runner }),
      ).rejects.toMatchObject({
        code: "PROCESS_FAILED",
        message: expect.stringContaining("pandoc Markdown input could not be read"),
      });
      expect(
        calls.some(({ args }) => args.includes("--output") || args.includes("--base-url")),
      ).toBe(false);
      await expect(stat(plan.outputPath)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("applies the asset policy before publishing AST-path outputs", async () => {
    await withTempFixtureDir("md-pdf-ast-asset-policy", async (dir) => {
      const input = join(dir, "report.md");
      const output = join(dir, "report.pdf");
      const htmlOutput = join(dir, "report.html");
      await writeFile(input, markdown);
      await writeFile(output, "existing PDF");
      await writeFile(htmlOutput, "existing HTML");
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="https://example.com/remote.svg"></body></html>',
        pandocJson: ast,
      });
      await expect(
        actionMdToPdf(runtime, { input, output, htmlOutput, overwrite: true, runner }),
      ).rejects.toThrow("Remote assets are disabled");
      expect(calls.some(({ args }) => args.includes("--base-url"))).toBe(false);
      expect(await readFile(output, "utf8")).toBe("existing PDF");
      expect(await readFile(htmlOutput, "utf8")).toBe("existing HTML");
    });
  });

  test("retains the metadata block when a styled heading cannot be confirmed in print", async () => {
    await withTempFixtureDir("md-pdf-styled-title", async (dir) => {
      const input = join(dir, "report.md");
      const css = join(dir, "print.css");
      const htmlOutput = join(dir, "report.html");
      await writeFile(input, markdown);
      await writeFile(css, "#heading { display: none; }");
      const header = '<header class="document-title"><h1>Report</h1></header>';
      const main = '<main class="document-body">' + header + '<h1 id="heading">Report</h1></main>';
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { runner: ordinary } = createPdfRunner({ html: main, pandocJson: ast });
      const prints: string[] = [];
      const runner: MarkdownPdfProcessRunner = async (command, args, opts) => {
        if (command === "weasyprint" && args.includes("--base-url")) {
          expect(args).toContain(css);
          expect(arg(args, "--allowed-protocols")).toBe("file,data");
          prints.push(await readFile(args.at(-2)!, "utf8"));
          if (args.includes("--pdf-variant")) return failing("tagged inspection unavailable");
        }
        return ordinary(command, args, opts);
      };
      await actionMdToPdf(runtime, {
        input,
        css,
        output: join(dir, "report.pdf"),
        htmlOutput,
        runner,
      });
      expect(prints).toHaveLength(2);
      expect(prints[0]).not.toContain(header);
      expect(prints[1]).toContain(header);
      expect(await readFile(htmlOutput, "utf8")).toBe(prints[1]!);
    });
  });

  test("reports both Pandoc stages when PDF production later fails", async () => {
    await withTempFixtureDir("md-pdf-ast-pdf-failure", async (dir) => {
      const input = join(dir, "report.md");
      const output = join(dir, "report.pdf");
      await writeFile(input, markdown);
      await writeFile(output, "existing PDF");
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { runner: pdfRunner } = createPdfRunner({
        html,
        pandocJson: ast,
        failWeasyprint: true,
      });
      const runner: MarkdownPdfProcessRunner = async (command, args, opts) => {
        const result = await pdfRunner(command, args, opts);
        const destination = arg(args, "--to");
        return command === "pandoc" && destination
          ? { ...result, stderr: `Pandoc ${destination} warning` }
          : result;
      };
      await expect(
        actionMdToPdf(runtime, { input, output, overwrite: true, runner }),
      ).rejects.toThrow(
        /Pandoc json warning.*Pandoc html warning.*weasyprint failed.*render failed/s,
      );
      expect(await readFile(output, "utf8")).toBe("existing PDF");
    });
  });

  test.each([
    { name: "matching eligible title", source: markdown, split: true, titleBlock: false },
    {
      name: "distinct eligible title",
      source: markdown.replace("# Report", "# Introduction"),
      split: true,
      pandocJson: pandocTitleJson("Report", "Introduction"),
    },
    { name: "missing title", source: "# Report\n" },
    { name: "empty title", source: "---\ntitle: '  '\n---\n\n# Report\n" },
    { name: "numeric title", source: "---\ntitle: 123\n---\n\n# 123\n" },
    { name: "title supplied by CLI metadata", source: "# Report\n", meta: ["title=Report"] },
    {
      name: "title supplied by profile metadata",
      source: "# Report\n",
      profile: "metadata:\n  title: Report\n",
    },
    { name: "explicit show", source: markdown, profile: "titleBlock:\n  metadataTitle: show\n" },
    {
      name: "explicit hide",
      source: markdown,
      profile: "titleBlock:\n  metadataTitle: hide\n",
      titleBlock: false,
    },
    {
      name: "enabled cover",
      source: markdown,
      profile: "cover:\n  enabled: true\n",
      titleBlock: false,
    },
    { name: "custom template", source: markdown, custom: true },
    { name: "bundle template", source: markdown, bundle: true },
  ])("chooses the expected route for $name", async (fixture) => {
    await withTempFixtureDir("md-pdf-ast-route", async (dir) => {
      const input = join(dir, "context.md");
      await writeFile(input, fixture.source);
      if (fixture.profile) await writeFile(join(dir, "profile.yml"), fixture.profile);
      if (fixture.custom || fixture.bundle) await writeFile(join(dir, "template.html"), customHtml);
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { calls, runner: pdfRunner } = createPdfRunner({
        html,
        pandocJson: fixture.pandocJson ?? ast,
      });
      let writerTemplate: string | undefined;
      const runner: MarkdownPdfProcessRunner = async (command, args, executionOptions) => {
        if (command === "pandoc" && arg(args, "--to") === "html") {
          writerTemplate = await readFile(arg(args, "--template")!, "utf8");
        }
        return pdfRunner(command, args, executionOptions);
      };

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input,
        ...(fixture.profile ? { profile: "profile.yml" } : {}),
        ...(fixture.custom ? { template: "template.html" } : {}),
        ...(fixture.bundle ? { bundle: dir } : {}),
        meta: fixture.meta && [...fixture.meta],
      });
      const plan = await planMarkdownPdfRender(runtime, prepared, { output: "report.pdf" });
      expect(calls).toEqual([]);
      await executePlannedMarkdownPdfRender(runtime, plan, { runner });

      const conversions = calls.filter(
        ({ command, args }) => command === "pandoc" && !args.includes("--version"),
      );
      expect(conversions.map(({ args }) => [arg(args, "--from"), arg(args, "--to")])).toEqual(
        fixture.split
          ? [
              ["markdown", "json"],
              ["json", "html"],
            ]
          : [["markdown", "html"]],
      );
      if (fixture.custom || fixture.bundle) expect(conversions[0]?.args[0]).toBe(input);
      expect(writerTemplate).toBeDefined();
      expect(writerTemplate?.includes('class="document-title"')).toBe(
        fixture.titleBlock ?? !(fixture.custom || fixture.bundle),
      );
    });
  });

  test("uses one source snapshot and the original JSON checkpoint through the CLI action", async () => {
    await withTempFixtureDir("md-pdf-ast-handoff", async (dir) => {
      const input = join(dir, "report.md");
      await writeFile(input, markdown);
      const checkpointBytes = " \n" + ast + "\n\n";
      const { runner: pdfRunner } = createPdfRunner({
        html,
        pandocJson: checkpointBytes,
        weasyprintStderr: "PDF warning",
      });
      const { runtime, stderr } = createActionTestRuntime({ cwd: dir });
      const stages: string[] = [];
      let checkpoint: string | undefined;
      const runner: MarkdownPdfProcessRunner = async (command, args, opts) => {
        const destination = arg(args, "--to");
        if (command === "pandoc" && destination === "json") {
          stages.push("reader");
          expect(opts?.cwd).toBe(dir);
          expect(args[0]).not.toBe(input);
          // The reader receives the original bytes even if the editable file changes now.
          await writeFile(input, "---\ntitle: 123\n---\n\n# 123\n");
          expect(await readFile(args[0]!, "utf8")).toBe(markdown);
          checkpoint = arg(args, "--output");
          const result = await pdfRunner(command, args, opts);
          return { ...result, stderr: "Reader first\nReader second" };
        }
        if (command === "pandoc" && destination === "html") {
          stages.push("writer");
          expect(opts?.cwd).toBe(dir);
          expect(arg(args, "--from")).toBe("json");
          expect(args[0]).toBe(checkpoint);
          expect(await readFile(args[0]!, "utf8")).toBe(checkpointBytes);
          expect(arg(args, "--toc-depth")).toBe("2");
          expect(args).toContain("--standalone");
          expect(args).toContain("--toc");
          expect(await readFile(arg(args, "--template")!, "utf8")).not.toContain("document-title");
          const result = await pdfRunner(command, args, opts);
          return { ...result, stderr: "Writer warning" };
        }
        return pdfRunner(command, args, opts);
      };

      await actionMdToPdf(runtime, {
        input,
        output: "report.pdf",
        htmlOutput: "report.html",
        toc: true,
        tocDepth: 2,
        runner,
      });
      expect(stages).toEqual(["reader", "writer"]);
      const warnings = ["Reader first", "Reader second", "Writer warning", "PDF warning"];
      const indexes = warnings.map((warning) => stderr.text.indexOf(warning));
      expect(indexes[0]).toBeGreaterThanOrEqual(0);
      expect(indexes).toEqual([...new Set(indexes)].sort((a, b) => a - b));
      expect(await readFile(join(dir, "report.html"), "utf8")).toBe(html);
      expect(await readFile(join(dir, "report.pdf"), "utf8")).toContain("%PDF");
      await expect(stat(dirname(checkpoint!))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("keeps the direct fallback on the snapshot if a title is added during execution", async () => {
    await withTempFixtureDir("md-pdf-direct-source-handoff", async (dir) => {
      const input = join(dir, "report.md");
      const untitled = "# First body\n";
      await writeFile(input, untitled);
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { runner: pdfRunner, calls } = createPdfRunner({ html });
      const runner: MarkdownPdfProcessRunner = async (command, args, opts) => {
        if (command === "pandoc" && arg(args, "--to") === "html") {
          await writeFile(input, markdown);
          expect(arg(args, "--from")).toBe("markdown");
          expect(opts?.cwd).toBe(dir);
          expect(args[0]).not.toBe(input);
          expect(await readFile(args[0]!, "utf8")).toBe(untitled);
        }
        return pdfRunner(command, args, opts);
      };
      await actionMdToPdf(runtime, { input, output: "report.pdf", runner });
      expect(
        calls.filter(({ command, args }) => command === "pandoc" && arg(args, "--to")),
      ).toHaveLength(1);
    });
  });

  test.each([
    { name: "adds a title", before: "# Report\n", after: markdown, split: true },
    {
      name: "changes the title to a number",
      before: markdown,
      after: "---\ntitle: 123\n---\n\n# 123\n",
      split: false,
    },
  ])("a prepared render uses the current Markdown when a source edit $name", async (fixture) => {
    await withTempFixtureDir("md-pdf-ast-rebind-source", async (dir) => {
      const input = join(dir, "report.md");
      await writeFile(input, fixture.before);
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { runner: pdfRunner, calls } = createPdfRunner({ html, pandocJson: ast });
      const prepared = await prepareMarkdownPdfRender(runtime, { input });
      const plan = await planMarkdownPdfRender(runtime, prepared, { output: "report.pdf" });

      await writeFile(input, fixture.after);
      const runner: MarkdownPdfProcessRunner = async (command, args, opts) => {
        if (command === "pandoc" && arg(args, "--to") === "html") {
          const template = await readFile(arg(args, "--template")!, "utf8");
          expect(template.includes("document-title")).toBe(!fixture.split);
        }
        return pdfRunner(command, args, opts);
      };
      await executePlannedMarkdownPdfRender(runtime, plan, { runner });
      expect(
        calls.filter(({ command, args }) => command === "pandoc" && arg(args, "--to") === "json"),
      ).toHaveLength(fixture.split ? 1 : 0);
    });
  });

  test.each([
    { stage: "reader", message: /Markdown reader failed.*reader stderr/s, writerCalls: 0 },
    {
      stage: "missing checkpoint",
      message: /reader warning.*JSON output could not be read/s,
      writerCalls: 0,
    },
    {
      stage: "malformed JSON",
      message: /reader warning.*JSON output could not be read/s,
      writerCalls: 0,
    },
    {
      stage: "invalid envelope",
      message: /reader warning.*JSON output has an invalid document envelope/s,
      writerCalls: 0,
    },
    {
      stage: "writer",
      message: /reader warning.*HTML writer failed.*writer stderr/s,
      writerCalls: 1,
    },
    {
      stage: "writer launch",
      message: /reader warning.*HTML writer failed to run.*spawn denied/s,
      writerCalls: 1,
    },
  ])("keeps outputs and cleans up after $stage failure", async (fixture) => {
    await withTempFixtureDir("md-pdf-ast-failure", async (dir) => {
      const input = join(dir, "report.md");
      const output = join(dir, "report.pdf");
      const htmlOutput = join(dir, "report.html");
      await writeFile(input, markdown);
      await writeFile(output, "existing PDF");
      await writeFile(htmlOutput, "existing HTML");
      const { runtime } = createActionTestRuntime({ cwd: dir });
      const { runner: pdfRunner, calls } = createPdfRunner({ html });
      let temporary: string | undefined;
      let writerCalls = 0;
      const runner: MarkdownPdfProcessRunner = async (command, args, opts) => {
        const destination = arg(args, "--to");
        if (command === "pandoc" && destination === "json") {
          const checkpoint = arg(args, "--output")!;
          temporary = dirname(checkpoint);
          if (fixture.stage === "reader") return failing("reader stderr");
          if (fixture.stage !== "missing checkpoint") {
            const result =
              fixture.stage === "malformed JSON"
                ? "{"
                : fixture.stage === "invalid envelope"
                  ? '{"pandoc-api-version":[1],"meta":[],"blocks":[]}'
                  : ast;
            await writeFile(checkpoint, result);
          }
          return ok("", "reader warning");
        }
        if (command === "pandoc" && destination === "html") {
          writerCalls++;
          if (fixture.stage === "writer launch") throw new Error("spawn denied");
          return failing("writer stderr");
        }
        return pdfRunner(command, args, opts);
      };
      await expect(
        actionMdToPdf(runtime, { input, output, htmlOutput, overwrite: true, runner }),
      ).rejects.toMatchObject({
        code: "PROCESS_FAILED",
        message: expect.stringMatching(fixture.message),
      });
      expect(writerCalls).toBe(fixture.writerCalls);
      expect(
        calls.some(({ command, args }) => command === "weasyprint" && args.includes("--base-url")),
      ).toBe(false);
      expect(await readFile(output, "utf8")).toBe("existing PDF");
      expect(await readFile(htmlOutput, "utf8")).toBe("existing HTML");
      expect(temporary).toBeDefined();
      await expect(stat(temporary!)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });
});
