import { test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { MarkdownPdfProcessRunner } from "../src/cli/markdown-pdf";
import type { ExecCommandResult } from "../src/cli/process";

export function ok(stdout = "", stderr = ""): ExecCommandResult {
  return {
    ok: true,
    code: 0,
    signal: null,
    stdout,
    stderr,
  };
}

export function failing(stderr: string): ExecCommandResult {
  return {
    ok: false,
    code: 1,
    signal: null,
    stdout: "",
    stderr,
  };
}

export function createPdfRunner(options: {
  html: string;
  weasyprintStderr?: string;
  failPandoc?: boolean;
  failWeasyprint?: boolean;
}) {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
    calls.push({ command, args, cwd: runnerOptions?.cwd });

    if (command === "pandoc" && args.includes("--version")) {
      return ok("pandoc 3.1\n");
    }
    if (command === "weasyprint" && args.includes("--info")) {
      return ok("System: test\nWeasyPrint 68.0\n");
    }
    if (command === "pandoc") {
      if (options.failPandoc) {
        return failing("pandoc render failed");
      }
      const outputIndex = args.indexOf("--output");
      const htmlOutput = args[outputIndex + 1];
      if (!htmlOutput) {
        return failing("missing output");
      }
      await mkdir(dirname(htmlOutput), { recursive: true });
      await writeFile(htmlOutput, options.html, "utf8");
      return ok();
    }
    if (command === "weasyprint") {
      if (options.failWeasyprint) {
        return failing("render failed");
      }
      const outputPath = args.at(-1);
      if (!outputPath) {
        return failing("missing pdf output");
      }
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, "%PDF-1.7\n", "utf8");
      return ok("", options.weasyprintStderr);
    }

    return failing(`unexpected command: ${command}`);
  };

  return { calls, runner };
}

export function createRemoteInlineCssHtml(): string {
  return [
    "<html><head>",
    '<style>@import url("https://example.com/print.css");</style>',
    "</head><body>",
    '<div style="background-image: url(https://example.com/banner.png)">Report</div>',
    "</body></html>",
  ].join("");
}

function hasCommand(command: string): boolean {
  const result = Bun.spawnSync({
    cmd: ["/bin/sh", "-c", `command -v ${command}`],
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}

export const pandocTest = hasCommand("pandoc") ? test : test.skip;
