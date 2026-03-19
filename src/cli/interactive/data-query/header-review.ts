import type { DuckDBConnection } from "@duckdb/node-api";
import { confirm, input, select } from "@inquirer/prompts";

import { printLine } from "../../actions/shared";
import {
  normalizeAndValidateAcceptedHeaderMappings,
  normalizeHeaderMappingTargetName,
  suggestDataHeaderMappingsWithCodex,
  type DataHeaderMappingEntry,
} from "../../duckdb/header-mapping";
import {
  collectDataQuerySourceIntrospection,
  type DataQueryInputFormat,
  type DataQuerySourceIntrospection,
} from "../../duckdb/query";
import type { CliRuntime } from "../../types";
import { createInteractiveAnalyzerStatus } from "../analyzer-status";
import { renderIntrospectionSummary } from "./source-shape";
import type { InteractiveContinuationLabels, InteractiveHeaderReviewState } from "./types";
import { QUERY_CONTINUATION_LABELS } from "./types";

const DATA_QUERY_INTERACTIVE_SAMPLE_ROWS = 5;

function hasGeneratedHeaderColumns(introspection: DataQuerySourceIntrospection): boolean {
  return introspection.columns.some((column) => /^column_\d+$/i.test(column.name));
}

function renderInteractiveHeaderSuggestions(
  runtime: CliRuntime,
  mappings: readonly DataHeaderMappingEntry[],
): void {
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Suggested headers");
  printLine(runtime.stderr, "");

  for (const mapping of mappings) {
    const details = [
      `${mapping.from} -> ${mapping.to}`,
      typeof mapping.sample === "string" ? `sample: ${JSON.stringify(mapping.sample)}` : undefined,
      typeof mapping.inferredType === "string" ? `type: ${mapping.inferredType}` : undefined,
    ].filter((value): value is string => Boolean(value));
    printLine(runtime.stderr, `- ${details.join("  ")}`);
  }
}

function validateInteractiveHeaderMappings(
  mappings: readonly DataHeaderMappingEntry[],
  availableColumns: readonly string[],
): true | string {
  try {
    normalizeAndValidateAcceptedHeaderMappings({
      availableColumns,
      mappings,
    });
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function reviewInteractiveHeaderMappings(options: {
  connection: DuckDBConnection;
  format: DataQueryInputFormat;
  inputPath: string;
  introspection: DataQuerySourceIntrospection;
  labels?: InteractiveContinuationLabels;
  runtime: CliRuntime;
  selectedBodyStartRow?: number;
  selectedHeaderRow?: number;
  selectedRange?: string;
  selectedSource?: string;
}): Promise<InteractiveHeaderReviewState> {
  const labels = options.labels ?? QUERY_CONTINUATION_LABELS;
  if (!hasGeneratedHeaderColumns(options.introspection)) {
    return {
      introspection: options.introspection,
    };
  }

  const wantsReview = await confirm({
    message: `Review semantic header suggestions before ${labels.reviewPromptLabel}?`,
    default: true,
  });
  if (!wantsReview) {
    return {
      introspection: options.introspection,
    };
  }

  const status = createInteractiveAnalyzerStatus(options.runtime.stdout, options.runtime.colorEnabled);
  let suggestionResult;
  try {
    status.wait("Waiting for Codex header suggestions");
    suggestionResult = await suggestDataHeaderMappingsWithCodex({
      format: options.format,
      introspection: options.introspection,
      workingDirectory: options.runtime.cwd,
    });
  } finally {
    status.stop();
  }

  if (suggestionResult.errorMessage) {
    printLine(options.runtime.stderr, `Codex header suggestions failed: ${suggestionResult.errorMessage}`);
    printLine(options.runtime.stderr, "Keeping current headers.");
    return {
      introspection: options.introspection,
    };
  }

  if (suggestionResult.mappings.length === 0) {
    printLine(options.runtime.stderr, "No semantic header changes were suggested. Keeping current headers.");
    return {
      introspection: options.introspection,
    };
  }

  let workingMappings = suggestionResult.mappings.map((mapping) => ({ ...mapping }));
  const availableColumns = options.introspection.columns.map((column) => column.name);

  while (true) {
    renderInteractiveHeaderSuggestions(options.runtime, workingMappings);
    const reviewAction = await select<"accept" | "edit" | "keep">({
      message: "Header suggestion review",
      choices: [
        {
          name: "Accept all",
          value: "accept",
          description: `Use the suggested semantic headers and re-inspect before ${labels.continuationLabel}`,
        },
        {
          name: "Edit one",
          value: "edit",
          description: "Adjust one suggested target header before acceptance",
        },
        {
          name: "Keep generated names",
          value: "keep",
          description: "Ignore the suggestions and continue with the current headers",
        },
      ],
    });

    if (reviewAction === "keep") {
      return {
        introspection: options.introspection,
      };
    }

    if (reviewAction === "accept") {
      const acceptedMappings = normalizeAndValidateAcceptedHeaderMappings({
        availableColumns,
        mappings: workingMappings,
      });
      printLine(options.runtime.stderr, `Accepted header mappings. Re-inspecting shaped source before ${labels.continuationLabel}.`);
      const introspection = await collectDataQuerySourceIntrospection(
        options.connection,
        options.inputPath,
        options.format,
        {
          bodyStartRow: options.selectedBodyStartRow,
          headerMappings: acceptedMappings,
          headerRow: options.selectedHeaderRow,
          range: options.selectedRange,
          source: options.selectedSource,
        },
        DATA_QUERY_INTERACTIVE_SAMPLE_ROWS,
      );
      renderIntrospectionSummary(options.runtime, {
        format: options.format,
        inputPath: options.inputPath,
        introspection,
      });
      return {
        headerMappings: acceptedMappings,
        introspection,
      };
    }

    const selectedFrom = await select<string>({
      message: "Choose one mapping to edit",
      choices: workingMappings.map((mapping) => ({
        name: `${mapping.from} -> ${mapping.to}`,
        value: mapping.from,
      })),
    });
    const currentMapping = workingMappings.find((mapping) => mapping.from === selectedFrom);
    const updatedTarget = await input({
      default: currentMapping?.to ?? "",
      message: `Header for ${selectedFrom}`,
      validate: (value) =>
        validateInteractiveHeaderMappings(
          workingMappings.map((mapping) =>
            mapping.from === selectedFrom
              ? {
                  ...mapping,
                  to: normalizeHeaderMappingTargetName(value),
                }
              : mapping,
          ),
          availableColumns,
        ),
    });

    workingMappings = normalizeAndValidateAcceptedHeaderMappings({
      availableColumns,
      mappings: workingMappings.map((mapping) =>
        mapping.from === selectedFrom
          ? {
              ...mapping,
              to: normalizeHeaderMappingTargetName(updatedTarget),
            }
          : mapping,
      ),
    });
  }
}
