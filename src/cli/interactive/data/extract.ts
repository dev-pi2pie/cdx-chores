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
import { writeInteractiveFlowTip } from "../contextual-tip";
import type { InteractivePathPromptContext } from "../shared";

type InteractiveExtractOutputFormat = "csv" | "tsv" | "json";

interface InteractiveExtractWritePlan {
  output: string;
  overwrite: boolean;
  outputFormat: InteractiveExtractOutputFormat;
}

interface InteractiveExtractSessionState {
  headerMappingCount: number;
  headerMappings?: Awaited<ReturnType<typeof reviewInteractiveHeaderMappings>>["headerMappings"];
  selectedBodyStartRow?: number;
  selectedHeaderRow?: number;
  selectedNoHeader?: boolean;
  selectedRange?: string;
  selectedSource?: string;
}

type InteractiveExtractReviewOutcome = "continue" | "revise" | "cancel";
type InteractiveExtractWriteOutcome =
  | { kind: "confirm"; plan: InteractiveExtractWritePlan }
  | { kind: "review" }
  | { kind: "cancel" };
type InteractiveExtractCheckpointOutcome =
  | { kind: "restart-setup" }
  | { kind: "cancel" }
  | { kind: "execute"; plan: InteractiveExtractWritePlan };

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

function renderInteractiveExtractReviewSummary(
  runtime: CliRuntime,
  options: {
    headerMappingCount: number;
    inputPath: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): void {
  printLine(runtime.stderr, "Extraction review");
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
  printLine(runtime.stderr, "- output setup: choose format and destination next");
}

async function confirmInteractiveExtractReview(
  runtime: CliRuntime,
  options: {
    headerMappingCount: number;
    inputPath: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveExtractReviewOutcome> {
  renderInteractiveExtractReviewSummary(runtime, options);
  const confirmed = await confirm({ message: "Continue to output setup?", default: true });
  if (confirmed) {
    return "continue";
  }

  return await select<"revise" | "cancel">({
    message: "Extraction review next step",
    choices: [
      {
        name: "Revise extraction setup",
        value: "revise",
        description: "Revisit source interpretation and semantic header review",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Stop before choosing an output destination",
      },
    ],
  });
}

function renderSkippedInteractiveExtractWrite(runtime: CliRuntime): void {
  printLine(runtime.stderr, "Skipped extraction write.");
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

async function confirmInteractiveExtractWrite(
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

async function collectInteractiveExtractSessionState(options: {
  connection: Awaited<ReturnType<typeof createDuckDbConnection>>;
  format: Awaited<ReturnType<typeof promptInteractiveInputFormat>>;
  input: string;
  inputPath: string;
  runtime: CliRuntime;
  sources: Awaited<ReturnType<typeof listDataQuerySources>>;
}): Promise<InteractiveExtractSessionState> {
  const noHeader = await promptDelimitedHeaderMode(options.format);
  const selectedSource = await promptOptionalSourceSelection(options.format, options.sources);
  const { introspection, sourceShape } = await collectInteractiveIntrospection({
    connection: options.connection,
    format: options.format,
    initialNoHeader: noHeader,
    inputPath: options.inputPath,
    labels: EXTRACT_CONTINUATION_LABELS,
    runtime: options.runtime,
    selectedSource,
  });
  const reviewedHeaders = await reviewInteractiveHeaderMappings({
    connection: options.connection,
    format: options.format,
    inputPath: options.inputPath,
    introspection,
    labels: EXTRACT_CONTINUATION_LABELS,
    runtime: options.runtime,
    selectedBodyStartRow: sourceShape.selectedBodyStartRow,
    selectedHeaderRow: sourceShape.selectedHeaderRow,
    selectedNoHeader: sourceShape.selectedNoHeader,
    selectedRange: sourceShape.selectedRange,
    selectedSource,
  });

  return {
    headerMappingCount: reviewedHeaders.headerMappings?.length ?? 0,
    ...(reviewedHeaders.headerMappings ? { headerMappings: reviewedHeaders.headerMappings } : {}),
    selectedBodyStartRow: sourceShape.selectedBodyStartRow,
    selectedHeaderRow: sourceShape.selectedHeaderRow,
    selectedNoHeader: sourceShape.selectedNoHeader,
    selectedRange: sourceShape.selectedRange,
    selectedSource,
  };
}

async function runInteractiveExtractCheckpointFlow(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: string,
  state: InteractiveExtractSessionState,
): Promise<InteractiveExtractCheckpointOutcome> {
  while (true) {
    const reviewOutcome = await confirmInteractiveExtractReview(runtime, {
      headerMappingCount: state.headerMappingCount,
      inputPath: input,
      selectedBodyStartRow: state.selectedBodyStartRow,
      selectedHeaderRow: state.selectedHeaderRow,
      selectedNoHeader: state.selectedNoHeader,
      selectedRange: state.selectedRange,
      selectedSource: state.selectedSource,
    });
    if (reviewOutcome === "cancel") {
      renderSkippedInteractiveExtractWrite(runtime);
      return { kind: "cancel" };
    }
    if (reviewOutcome === "revise") {
      return { kind: "restart-setup" };
    }

    const outputOutcome = await confirmInteractiveExtractWrite(runtime, pathPromptContext, {
      headerMappingCount: state.headerMappingCount,
      inputPath: input,
      selectedBodyStartRow: state.selectedBodyStartRow,
      selectedHeaderRow: state.selectedHeaderRow,
      selectedNoHeader: state.selectedNoHeader,
      selectedRange: state.selectedRange,
      selectedSource: state.selectedSource,
    });
    if (outputOutcome.kind === "review") {
      continue;
    }
    if (outputOutcome.kind === "cancel") {
      return { kind: "cancel" };
    }
    return { kind: "execute", plan: outputOutcome.plan };
  }
}

export async function runInteractiveDataExtract(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  writeInteractiveFlowTip(runtime, "data-extract");
  const input = await promptRequiredPathWithConfig("Input data file", {
    kind: "file",
    ...pathPromptContext,
  });
  const inputPath = resolveFromCwd(runtime, input);
  const format = await promptInteractiveInputFormat(runtime, inputPath);

  let connection;
  try {
    connection = await createDuckDbConnection();
    const sources = await listDataQuerySources(connection, inputPath, format);
    while (true) {
      const state = await collectInteractiveExtractSessionState({
        connection,
        format,
        input,
        inputPath,
        runtime,
        sources,
      });
      const checkpointOutcome = await runInteractiveExtractCheckpointFlow(
        runtime,
        pathPromptContext,
        input,
        state,
      );
      if (checkpointOutcome.kind === "restart-setup") {
        continue;
      }
      if (checkpointOutcome.kind === "cancel") {
        return;
      }

      await actionDataExtract(runtime, {
        ...(state.headerMappings ? { headerMappings: state.headerMappings } : {}),
        input,
        inputFormat: format,
        ...(state.selectedNoHeader ? { noHeader: true } : {}),
        output: checkpointOutcome.plan.output,
        overwrite: checkpointOutcome.plan.overwrite,
        ...(state.selectedBodyStartRow !== undefined
          ? { bodyStartRow: state.selectedBodyStartRow }
          : {}),
        ...(state.selectedHeaderRow !== undefined ? { headerRow: state.selectedHeaderRow } : {}),
        ...(state.selectedRange ? { range: state.selectedRange } : {}),
        ...(state.selectedSource ? { source: state.selectedSource } : {}),
      });
      return;
    }
  } catch (error) {
    maybeRenderDuckDbExtensionRemediationCommand(runtime, format, error);
    throw error;
  } finally {
    connection?.closeSync();
  }
}
