import { lstat } from "node:fs/promises";

import { confirm, input, select } from "@inquirer/prompts";

import { printLine } from "../../../actions/shared";
import { isSupportedDataStackDiscoveryPath } from "../../../data-stack/formats";
import {
  resolveDataStackInputSources,
  type DataStackNormalizedInputFile,
} from "../../../data-stack/input-router";
import {
  DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES,
  type DataStackInputFormat,
  type DataStackSchemaModeOption,
} from "../../../data-stack/types";
import { resolveFromCwd } from "../../../path-utils";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";

import { renderInteractiveInputSourceSummary, renderMatchedFileSummary } from "./review";
import {
  formatInteractiveStackPattern,
  usesInteractiveDirectoryDiscovery,
  type InteractiveDataStackMatchedFileAction,
  type InteractiveDataStackSetup,
  type InteractiveDataStackSource,
  type InteractiveDataStackSourceDiscoveryOption,
  type InteractiveDataStackSourceDiscoveryState,
  type InteractiveDataStackSourcePath,
} from "./types";

async function promptInteractiveStackInputFormat(): Promise<DataStackInputFormat> {
  return await select<DataStackInputFormat>({
    message: "Input format",
    choices: DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES.map((format) => ({
      name: format,
      value: format,
    })),
  });
}

async function promptInteractiveStackPattern(inputFormat: DataStackInputFormat): Promise<string> {
  return (
    await input({
      message: "Filename pattern",
      default: `*.${inputFormat}`,
      validate: (value) =>
        String(value).trim().length > 0 ? true : "Enter a filename pattern such as *.csv.",
    })
  ).trim();
}

async function inferInteractiveStackSourceKind(
  source: InteractiveDataStackSourcePath,
): Promise<"directory" | "file"> {
  try {
    const sourceStats = await lstat(source.resolved);
    if (sourceStats.isFile()) {
      return "file";
    }
    if (sourceStats.isDirectory()) {
      return "directory";
    }
  } catch {
    // Let the later resolver produce the user-facing missing-source error.
  }

  return isSupportedDataStackDiscoveryPath(source.raw) ? "file" : "directory";
}

function renderInteractiveStackSourceDiscovery(
  runtime: CliRuntime,
  options: {
    files: readonly DataStackNormalizedInputFile[];
    inputFormat: DataStackInputFormat;
    pattern?: string;
    recursive: boolean;
    sources: readonly InteractiveDataStackSource[];
  },
): void {
  printLine(runtime.stderr, "Source discovery");
  printLine(runtime.stderr, "");
  renderInteractiveInputSourceSummary(runtime, options.sources);
  printLine(runtime.stderr, `- input format: ${options.inputFormat.toUpperCase()}`);
  if (usesInteractiveDirectoryDiscovery(options.sources)) {
    printLine(
      runtime.stderr,
      `- pattern: ${formatInteractiveStackPattern(options.pattern, options.inputFormat)}`,
    );
    printLine(runtime.stderr, `- traversal: ${options.recursive ? "recursive" : "shallow only"}`);
  } else {
    printLine(runtime.stderr, "- pattern: skipped for explicit file sources");
  }
  renderMatchedFileSummary(runtime, { files: options.files });
}

async function promptInteractiveStackMatchedFiles(options: {
  allowAccept: boolean;
  allowOptions: boolean;
}): Promise<InteractiveDataStackMatchedFileAction> {
  return await select<InteractiveDataStackMatchedFileAction>({
    message: "Matched files",
    choices: [
      ...(options.allowAccept
        ? [
            {
              name: "Use these files",
              value: "accept" as const,
              description: "Continue to dry-run, schema, and duplicate setup",
            },
          ]
        : []),
      ...(options.allowOptions
        ? [
            {
              name: "Options",
              value: "options" as const,
              description: "Change source discovery settings and preview again",
            },
          ]
        : []),
      {
        name: "Revise sources",
        value: "sources",
        description: "Choose input files or directories again",
      },
      {
        name: "Cancel",
        value: "cancel",
        description: "Stop before preparing the stack plan",
      },
    ],
  });
}

async function promptInteractiveStackSourceDiscoveryOptions(options: {
  recursive: boolean;
}): Promise<InteractiveDataStackSourceDiscoveryOption> {
  return await select<InteractiveDataStackSourceDiscoveryOption>({
    message: "Source discovery options",
    choices: [
      {
        name: "Change filename pattern",
        value: "pattern",
        description: "Override the selected format's default filename match",
      },
      {
        name: options.recursive ? "Use shallow scan" : "Scan subdirectories",
        value: "recursive",
        description: options.recursive
          ? "Preview direct children only"
          : "Include nested subdirectories in the preview",
      },
      {
        name: "Change input format",
        value: "format",
        description: "Choose CSV, TSV, JSON, or JSONL and preview again",
      },
      {
        name: "Back to matched files",
        value: "back",
        description: "Return without changing source discovery settings",
      },
    ],
  });
}

function renderInteractiveStackDryRunPrimer(runtime: CliRuntime): void {
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Dry-run path");
  printLine(
    runtime.stderr,
    "- save a replayable stack plan without writing output; later run data stack replay <record>",
  );
}

async function collectInteractiveStackSources(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSourcePath[]> {
  const { promptRequiredPathWithConfig } = await import("../../../prompts/path");
  const sources: InteractiveDataStackSourcePath[] = [];

  while (true) {
    const source = await promptRequiredPathWithConfig(
      sources.length === 0 ? "Input source" : "Additional input source",
      {
        kind: "path",
        ...pathPromptContext,
      },
    );
    sources.push({
      raw: source,
      resolved: resolveFromCwd(runtime, source),
    });

    const addAnother = await confirm({ message: "Add another input source?", default: false });
    if (!addAnother) {
      break;
    }
  }

  return sources;
}

async function addInteractiveStackSourceKinds(
  sources: readonly InteractiveDataStackSourcePath[],
): Promise<InteractiveDataStackSource[]> {
  return await Promise.all(
    sources.map(async (source) => ({
      ...source,
      kind: await inferInteractiveStackSourceKind(source),
    })),
  );
}

async function updateInteractiveStackSourceDiscoveryState(
  state: InteractiveDataStackSourceDiscoveryState,
  sourcePaths: readonly InteractiveDataStackSourcePath[],
): Promise<InteractiveDataStackSourceDiscoveryState> {
  const discoveryOption = await promptInteractiveStackSourceDiscoveryOptions({
    recursive: state.recursive,
  });

  switch (discoveryOption) {
    case "pattern":
      return {
        ...state,
        pattern: await promptInteractiveStackPattern(state.inputFormat),
      };
    case "recursive":
      return {
        ...state,
        recursive: !state.recursive,
      };
    case "format": {
      const inputFormat = await promptInteractiveStackInputFormat();
      return {
        inputFormat,
        pattern: undefined,
        recursive: state.recursive,
        sources: await addInteractiveStackSourceKinds(sourcePaths),
      };
    }
    case "back":
      return state;
  }
}

async function promptInteractiveStackSchemaMode(): Promise<DataStackSchemaModeOption> {
  return await select<DataStackSchemaModeOption>({
    message: "Schema mode",
    choices: [
      {
        name: "Automatic schema check",
        value: "auto",
        description: "Use strict when possible, then deterministic union by name when safe",
      },
      {
        name: "Strict matching",
        value: "strict",
        description: "Require every matched file to use the same columns or keys",
      },
      {
        name: "Union by name",
        value: "union-by-name",
        description: "Opt in to named-schema union and fill missing values",
      },
    ],
  });
}

async function promptInteractiveStackExcludeColumns(
  schemaMode: DataStackSchemaModeOption,
): Promise<string[]> {
  if (schemaMode !== "union-by-name") {
    return [];
  }

  const value = (
    await input({
      message: "Exclude columns or keys (optional, comma-separated)",
    })
  ).trim();

  if (value.length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function collectInteractiveStackMatchedFiles(options: {
  inputFormat: DataStackInputFormat;
  runtime: CliRuntime;
  sourcePaths: readonly InteractiveDataStackSourcePath[];
}): Promise<
  | {
      inputFormat: DataStackInputFormat;
      pattern?: string;
      recursive: boolean;
      sources: InteractiveDataStackSource[];
    }
  | "sources"
  | "cancel"
> {
  let state: InteractiveDataStackSourceDiscoveryState = {
    inputFormat: options.inputFormat,
    pattern: undefined,
    recursive: false,
    sources: await addInteractiveStackSourceKinds(options.sourcePaths),
  };

  while (true) {
    const usesDirectorySource = usesInteractiveDirectoryDiscovery(state.sources);
    try {
      const preview = await resolveDataStackInputSources({
        inputFormat: state.inputFormat,
        pattern: state.pattern,
        recursive: state.recursive,
        sources: state.sources.map((source) => source.resolved),
      });
      renderInteractiveStackSourceDiscovery(options.runtime, {
        files: preview.files,
        inputFormat: state.inputFormat,
        pattern: state.pattern,
        recursive: state.recursive,
        sources: state.sources,
      });

      const previewAction = await promptInteractiveStackMatchedFiles({
        allowAccept: true,
        allowOptions: usesDirectorySource,
      });
      switch (previewAction) {
        case "accept":
          return state;
        case "options":
          state = await updateInteractiveStackSourceDiscoveryState(state, options.sourcePaths);
          continue;
        case "sources":
          return "sources";
        case "cancel":
          return "cancel";
      }
    } catch (error) {
      printLine(
        options.runtime.stderr,
        `Matched-file preview failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      const previewAction = await promptInteractiveStackMatchedFiles({
        allowAccept: false,
        allowOptions: usesDirectorySource,
      });
      switch (previewAction) {
        case "options":
          state = await updateInteractiveStackSourceDiscoveryState(state, options.sourcePaths);
          continue;
        case "sources":
          return "sources";
        case "cancel":
          return "cancel";
        case "accept":
          continue;
      }
    }
  }
}

export async function collectInteractiveStackSetup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackSetup | undefined> {
  while (true) {
    const rawSources = await collectInteractiveStackSources(runtime, pathPromptContext);
    const inputFormat = await promptInteractiveStackInputFormat();
    const matchedFiles = await collectInteractiveStackMatchedFiles({
      inputFormat,
      runtime,
      sourcePaths: rawSources,
    });
    switch (matchedFiles) {
      case "sources":
        continue;
      case "cancel":
        return undefined;
      default: {
        renderInteractiveStackDryRunPrimer(runtime);
        const schemaMode = await promptInteractiveStackSchemaMode();
        const excludeColumns = await promptInteractiveStackExcludeColumns(schemaMode);
        return {
          excludeColumns,
          inputFormat: matchedFiles.inputFormat,
          pattern: matchedFiles.pattern,
          recursive: matchedFiles.recursive,
          schemaMode,
          sources: matchedFiles.sources,
        };
      }
    }
  }
}
