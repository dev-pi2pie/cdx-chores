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
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  runtime: CliRuntime;
}): string {
  return publicPathFromCwd({
    path: input.outputPlan.outputDirectory,
    placeholder: "<project-bundle>",
    runtime: input.runtime,
  });
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
    "--bundle",
    publicProjectBundlePath({
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
