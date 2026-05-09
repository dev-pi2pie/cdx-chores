import { confirm, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../../actions/shared";
import { promptFileOutputTarget } from "../../../data-workflows/output";
import { defaultOutputPath, resolveFromCwd } from "../../../path-utils";
import { formatDefaultOutputPathHint } from "../../../prompts/path";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { renderSkippedInteractiveExtractWrite } from "./review";
import type {
  InteractiveExtractOutputFormat,
  InteractiveExtractWriteOutcome,
  InteractiveExtractWritePlan,
} from "./types";

async function promptInteractiveExtractOutput(
  runtime: CliRuntime,
  inputPath: string,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveExtractWritePlan> {
  const outputFormat = await select<InteractiveExtractOutputFormat>({
    message: "Output format",
    choices: [
      { name: "CSV", value: "csv" },
      { name: "TSV", value: "tsv" },
      { name: "JSON", value: "json" },
    ],
  });
  const outputHint = formatDefaultOutputPathHint(runtime, inputPath, `.${outputFormat}`);
  const target = await promptFileOutputTarget({
    runtime,
    pathPromptContext,
    message: `Output ${outputFormat.toUpperCase()} file`,
    allowedExtensions: [`.${outputFormat}`],
    invalidExtensionMessage: `Output file must end with .${outputFormat}.`,
    defaultHint: outputHint,
    customMessage: `Custom ${outputFormat.toUpperCase()} output path`,
    fallbackOutputPath: defaultOutputPath(inputPath, `.${outputFormat}`),
  });
  return {
    output: target.output,
    overwrite: target.overwrite,
    outputFormat,
  };
}

function renderInteractiveExtractWriteSummary(
  runtime: CliRuntime,
  options: {
    headerMappingCount: number;
    inputPath: string;
    outputPath: string;
    outputFormat: InteractiveExtractOutputFormat;
    overwrite: boolean;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): void {
  printLine(runtime.stderr, "Extraction write summary");
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `- input: ${displayPath(runtime, resolveFromCwd(runtime, options.inputPath))}`,
  );
  if (options.selectedSource) {
    printLine(runtime.stderr, `- source: ${options.selectedSource}`);
  }
  if (options.selectedRange) {
    printLine(runtime.stderr, `- range: ${options.selectedRange}`);
  }
  if (options.selectedNoHeader) {
    printLine(runtime.stderr, "- header mode: treat CSV/TSV input as headerless");
  }
  if (options.selectedBodyStartRow !== undefined) {
    printLine(runtime.stderr, `- body start row: ${options.selectedBodyStartRow}`);
  }
  if (options.selectedHeaderRow !== undefined) {
    printLine(runtime.stderr, `- header row: ${options.selectedHeaderRow}`);
  }
  printLine(
    runtime.stderr,
    `- headers: ${
      options.headerMappingCount > 0
        ? `${options.headerMappingCount} reviewed semantic mapping${options.headerMappingCount === 1 ? "" : "s"}`
        : "keep current column names"
    }`,
  );
  printLine(runtime.stderr, `- output format: ${options.outputFormat.toUpperCase()}`);
  printLine(
    runtime.stderr,
    `- output: ${displayPath(runtime, resolveFromCwd(runtime, options.outputPath))}`,
  );
  printLine(runtime.stderr, `- overwrite: ${options.overwrite ? "yes" : "no"}`);
}

export async function confirmInteractiveExtractWrite(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    headerMappingCount: number;
    inputPath: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveExtractWriteOutcome> {
  while (true) {
    const outputPlan = await promptInteractiveExtractOutput(
      runtime,
      options.inputPath,
      pathPromptContext,
    );
    renderInteractiveExtractWriteSummary(runtime, {
      ...options,
      outputPath: outputPlan.output,
      outputFormat: outputPlan.outputFormat,
      overwrite: outputPlan.overwrite,
    });
    const confirmed = await confirm({ message: "Write extracted output now?", default: true });
    if (confirmed) {
      return { kind: "confirm", plan: outputPlan };
    }

    const nextStep = await select<"review" | "destination" | "cancel">({
      message: "Extraction write next step",
      choices: [
        {
          name: "Back to extraction review",
          value: "review",
          description: "Return to the extraction review checkpoint before changing the setup",
        },
        {
          name: "Change destination",
          value: "destination",
          description: "Keep the current extraction setup and adjust only the output destination",
        },
        {
          name: "Cancel",
          value: "cancel",
          description: "Stop before materializing the extracted output",
        },
      ],
    });
    if (nextStep === "review") {
      return { kind: "review" };
    }
    if (nextStep === "cancel") {
      renderSkippedInteractiveExtractWrite(runtime);
      return { kind: "cancel" };
    }
  }
}
