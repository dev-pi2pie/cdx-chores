import {
  collectInteractiveIntrospection,
  promptDelimitedHeaderMode,
  promptInteractiveInputFormat,
  promptOptionalSourceSelection,
  reviewInteractiveHeaderMappings,
} from "../../data-query";
import type { createDuckDbConnection, listDataQuerySources } from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { confirmInteractiveExtractWrite } from "./output";
import { confirmInteractiveExtractReview, renderSkippedInteractiveExtractWrite } from "./review";
import {
  EXTRACT_CONTINUATION_LABELS,
  type InteractiveExtractCheckpointOutcome,
  type InteractiveExtractSessionState,
} from "./types";

export async function collectInteractiveExtractSessionState(options: {
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

export async function runInteractiveExtractCheckpointFlow(
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
