import { join } from "node:path";

import type { CliRuntime } from "../../types";
import { publicPathFromCwd, shellQuote } from "../codex-path-display";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";

export interface MarkdownPdfProjectCodexRenderCommand {
  executable: "cdx-chores";
  args: string[];
  display: string;
}

function publicInputPath(runtime: CliRuntime, inputPath: string | undefined): string {
  return publicPathFromCwd({ path: inputPath, placeholder: "<input.md>", runtime });
}

function publicProjectBundlePath(input: {
  bundlePath: string;
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  runtime: CliRuntime;
}): string {
  const outputDirectory = publicPathFromCwd({
    path: input.outputPlan.outputDirectory,
    placeholder: "<project-bundle>",
    runtime: input.runtime,
  });
  if (outputDirectory === "<project-bundle>") {
    return join("<project-bundle>", input.bundlePath);
  }
  return join(outputDirectory, input.bundlePath);
}

export function createMdPdfProjectCodexRenderCommand(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
}): MarkdownPdfProjectCodexRenderCommand {
  const args = [
    "md",
    "to-pdf",
    "--input",
    publicInputPath(input.runtime, input.state.inputPath),
    "--profile",
    publicProjectBundlePath({
      bundlePath: input.outputPlan.profile.bundlePath,
      outputPlan: input.outputPlan,
      runtime: input.runtime,
    }),
    "--template",
    publicProjectBundlePath({
      bundlePath: input.outputPlan.templateHtml.bundlePath,
      outputPlan: input.outputPlan,
      runtime: input.runtime,
    }),
    "--css",
    publicProjectBundlePath({
      bundlePath: input.outputPlan.styleCss.bundlePath,
      outputPlan: input.outputPlan,
      runtime: input.runtime,
    }),
    "--output",
    "<output.pdf>",
  ];
  return {
    executable: "cdx-chores",
    args,
    display: ["cdx-chores", ...args.map(shellQuote)].join(" "),
  };
}
