import { confirm, select } from "@inquirer/prompts";

import { actionDataExtract } from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import { maybeRenderDuckDbExtensionRemediationCommand } from "../../data-workflows/duckdb-remediation";
import { promptFileOutputTarget } from "../../data-workflows/output";
import { createDuckDbConnection, listDataQuerySources } from "../../duckdb/query";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import {
  collectInteractiveIntrospection,
  promptDelimitedHeaderMode,
  promptInteractiveInputFormat,
  promptOptionalSourceSelection,
  reviewInteractiveHeaderMappings,
} from "../data-query";
import { formatDefaultOutputPathHint, promptRequiredPathWithConfig } from "../../prompts/path";
import type { InteractivePathPromptContext } from "../shared";

type InteractiveExtractOutputFormat = "csv" | "tsv" | "json";

interface InteractiveExtractWritePlan {
  output: string;
  overwrite: boolean;
  outputFormat: InteractiveExtractOutputFormat;
}

const EXTRACT_CONTINUATION_LABELS = {
  continuationLabel: "extraction",
  notWritingLabel: "output yet",
  reviewPromptLabel: "extraction",
} as const;

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
    selectedRange?: string;
    selectedSource?: string;
  },
): void {
  printLine(runtime.stderr, "");
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

async function confirmInteractiveExtractWrite(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    headerMappingCount: number;
    inputPath: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveExtractWritePlan | undefined> {
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
      return outputPlan;
    }

    const nextStep = await select<"destination" | "cancel">({
      message: "Extraction write next step",
      choices: [
        {
          name: "choose another destination",
          value: "destination",
          description: "Adjust the output format or destination before writing",
        },
        {
          name: "cancel",
          value: "cancel",
          description: "Stop before materializing the extracted output",
        },
      ],
    });
    if (nextStep === "cancel") {
      printLine(runtime.stderr, "Skipped extraction write.");
      return undefined;
    }
  }
}

export async function runInteractiveDataExtract(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const input = await promptRequiredPathWithConfig("Input data file", {
    kind: "file",
    ...pathPromptContext,
  });
  const inputPath = resolveFromCwd(runtime, input);
  const format = await promptInteractiveInputFormat(runtime, inputPath);
  const noHeader = await promptDelimitedHeaderMode(format);

  let connection;
  try {
    connection = await createDuckDbConnection();
    const sources = await listDataQuerySources(connection, inputPath, format);
    const selectedSource = await promptOptionalSourceSelection(format, sources);
    const { introspection, sourceShape } = await collectInteractiveIntrospection({
      connection,
      format,
      initialNoHeader: noHeader,
      inputPath,
      labels: EXTRACT_CONTINUATION_LABELS,
      runtime,
      selectedSource,
    });
    const reviewedHeaders = await reviewInteractiveHeaderMappings({
      connection,
      format,
      inputPath,
      introspection,
      labels: EXTRACT_CONTINUATION_LABELS,
      runtime,
      selectedBodyStartRow: sourceShape.selectedBodyStartRow,
      selectedHeaderRow: sourceShape.selectedHeaderRow,
      selectedNoHeader: sourceShape.selectedNoHeader,
      selectedRange: sourceShape.selectedRange,
      selectedSource,
    });
    const outputOptions = await confirmInteractiveExtractWrite(runtime, pathPromptContext, {
      headerMappingCount: reviewedHeaders.headerMappings?.length ?? 0,
      inputPath: input,
      selectedBodyStartRow: sourceShape.selectedBodyStartRow,
      selectedHeaderRow: sourceShape.selectedHeaderRow,
      selectedRange: sourceShape.selectedRange,
      selectedSource,
    });
    if (!outputOptions) {
      return;
    }

    await actionDataExtract(runtime, {
      ...(reviewedHeaders.headerMappings ? { headerMappings: reviewedHeaders.headerMappings } : {}),
      input,
      inputFormat: format,
      ...(sourceShape.selectedNoHeader ? { noHeader: true } : {}),
      output: outputOptions.output,
      overwrite: outputOptions.overwrite,
      ...(sourceShape.selectedBodyStartRow !== undefined
        ? { bodyStartRow: sourceShape.selectedBodyStartRow }
        : {}),
      ...(sourceShape.selectedHeaderRow !== undefined
        ? { headerRow: sourceShape.selectedHeaderRow }
        : {}),
      ...(sourceShape.selectedRange ? { range: sourceShape.selectedRange } : {}),
      ...(selectedSource ? { source: selectedSource } : {}),
    });
  } catch (error) {
    maybeRenderDuckDbExtensionRemediationCommand(runtime, format, error);
    throw error;
  } finally {
    connection?.closeSync();
  }
}
