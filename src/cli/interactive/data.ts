import type { CliRuntime } from "../types";
import type { DataInteractiveActionKey } from "./menu";
import {
  handleDirectDataConversionAction,
  isDirectDataConversionAction,
} from "./data/conversion-actions";
import { runInteractiveDataConvert } from "./data/convert";
import { runInteractiveDataExtract } from "./data/extract";
import { runInteractiveDataPreview, runInteractiveParquetPreview } from "./data/preview";
import { runInteractiveDataStack } from "./data/stack";
import { runInteractiveDataQuery } from "./data-query";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";

export async function handleDataInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: DataInteractiveActionKey,
): Promise<void> {
  if (action === "data:convert") {
    await runInteractiveDataConvert(runtime, pathPromptContext);
    return;
  }

  if (action === "data:query") {
    await runInteractiveDataQuery(runtime, pathPromptContext);
    return;
  }

  if (action === "data:extract") {
    await runInteractiveDataExtract(runtime, pathPromptContext);
    return;
  }

  if (action === "data:stack") {
    await runInteractiveDataStack(runtime, pathPromptContext);
    return;
  }

  if (action === "data:preview") {
    await runInteractiveDataPreview(runtime, pathPromptContext);
    return;
  }

  if (action === "data:parquet-preview") {
    await runInteractiveParquetPreview(runtime, pathPromptContext);
    return;
  }

  if (isDirectDataConversionAction(action)) {
    await handleDirectDataConversionAction(runtime, pathPromptContext, action);
    return;
  }

  assertNeverInteractiveAction(action);
}
