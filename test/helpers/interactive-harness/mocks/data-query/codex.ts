import { mock } from "bun:test";

import {
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
  normalizeDataQueryCodexIntent,
} from "../../../../../src/cli/data-query/prompt";
import type { HarnessRunnerContext } from "../../context";
import { dataQueryCodexModuleUrl } from "../../module-urls";
import type { DataQueryCodexDraftOptions } from "./types";

export function installDataQueryCodexMock(context: HarnessRunnerContext): void {
  mock.module(dataQueryCodexModuleUrl, () => ({
    normalizeDataQueryCodexIntent,
    normalizeDataQueryCodexEditorIntent,
    buildDataQueryCodexIntentEditorTemplate,
    draftDataQueryWithCodex: async (options: DataQueryCodexDraftOptions) => {
      context.recordAction("data:query:codex-draft", {
        format: options.format,
        intent: options.intent,
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "selectedHeaderRow" in options.introspection &&
        options.introspection.selectedHeaderRow !== undefined
          ? { selectedHeaderRow: options.introspection.selectedHeaderRow }
          : {}),
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "selectedRange" in options.introspection &&
        options.introspection.selectedRange
          ? { selectedRange: options.introspection.selectedRange }
          : {}),
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "selectedSource" in options.introspection
          ? { selectedSource: options.introspection.selectedSource }
          : {}),
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "relations" in options.introspection
          ? {
              relations: Array.isArray(options.introspection.relations)
                ? options.introspection.relations.map((relation) => ({
                    alias: relation.alias,
                    columns:
                      Array.isArray((relation as { columns?: unknown[] }).columns) &&
                      (relation as { columns?: unknown[] }).columns
                        ? (relation as { columns?: unknown[] }).columns
                        : undefined,
                    sampleRows:
                      Array.isArray((relation as { sampleRows?: unknown[] }).sampleRows) &&
                      (relation as { sampleRows?: unknown[] }).sampleRows
                        ? (relation as { sampleRows?: unknown[] }).sampleRows
                        : undefined,
                    source: relation.source,
                    truncated:
                      "truncated" in relation
                        ? (relation as { truncated?: unknown }).truncated
                        : undefined,
                  }))
                : undefined,
            }
          : {}),
      });

      if (context.scenario.dataQueryCodexErrorMessage) {
        return { errorMessage: context.scenario.dataQueryCodexErrorMessage };
      }

      return {
        draft: context.scenario.dataQueryCodexDraft ?? {
          sql: "select count(*) as total from file",
          reasoningSummary: "Counts rows from the selected source.",
        },
      };
    },
  }));
}
