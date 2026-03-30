import { confirm, editor, input, select } from "@inquirer/prompts";

import { printLine } from "../../../actions/shared";
import {
  buildDataQueryCodexIntentEditorTemplate,
  draftDataQueryWithCodex,
  normalizeDataQueryCodexEditorIntent,
  normalizeDataQueryCodexIntent,
} from "../../../data-query/codex";
import type { DataHeaderMappingEntry } from "../../../duckdb/header-mapping";
import type { DataQueryInputFormat, DataQuerySourceIntrospection } from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";
import { createInteractiveAnalyzerStatus } from "../../analyzer-status";
import type { InteractivePathPromptContext } from "../../shared";
import { executeInteractiveCandidate } from "../execution";
import type { InteractiveQueryRunResult } from "../types";

function renderCodexIntentPreview(runtime: CliRuntime, intent: string): void {
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Intent: ${intent}`);
}

export async function runCodexInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    headerMappings?: DataHeaderMappingEntry[];
    input: string;
    introspection: DataQuerySourceIntrospection;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveQueryRunResult> {
  let lastIntent = "";
  let preferMultilineEditor = false;

  while (true) {
    const useMultilineEditor = await confirm({
      message: "Use multiline editor?",
      default: preferMultilineEditor,
    });
    preferMultilineEditor = useMultilineEditor;
    const intent = useMultilineEditor
      ? await (async (): Promise<string> => {
          while (true) {
            const intentValue = await editor({
              default: buildDataQueryCodexIntentEditorTemplate({
                format: options.format,
                intent: lastIntent,
                introspection: options.introspection,
              }),
              message: "Describe the query intent:",
              postfix: ".md",
              validate: (value) =>
                normalizeDataQueryCodexEditorIntent(value).length > 0
                  ? true
                  : "Enter a query intent.",
            });
            const cleanedIntent = normalizeDataQueryCodexEditorIntent(intentValue);
            renderCodexIntentPreview(runtime, cleanedIntent);
            const confirmed = await confirm({
              message: "Send this intent to Codex drafting?",
              default: true,
            });
            if (confirmed) {
              return cleanedIntent;
            }
            lastIntent = cleanedIntent;
          }
        })()
      : normalizeDataQueryCodexIntent(
          await input({
            default: lastIntent,
            message: "Describe the query intent:",
            validate: (value) =>
              normalizeDataQueryCodexIntent(value).length > 0 ? true : "Enter a query intent.",
          }),
        );
    lastIntent = intent;

    while (true) {
      const statusStream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };
      const status = statusStream.isTTY
        ? createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled)
        : {
            start() {},
            update() {},
            wait() {},
            stop() {},
          };

      try {
        status.wait("Drafting SQL with Codex");
        const draftResult = await draftDataQueryWithCodex({
          format: options.format,
          intent,
          introspection: options.introspection,
          workingDirectory: runtime.cwd,
        });
        status.stop();

        if (!draftResult.draft) {
          printLine(
            runtime.stderr,
            `Codex drafting failed: ${draftResult.errorMessage ?? "Unknown error."}`,
          );
        } else {
          const executionResult = await executeInteractiveCandidate(runtime, pathPromptContext, {
            format: options.format,
            headerMappings: options.headerMappings,
            input: options.input,
            reviewMode: "codex",
            selectedBodyStartRow: options.selectedBodyStartRow,
            selectedHeaderRow: options.selectedHeaderRow,
            selectedNoHeader: options.selectedNoHeader,
            selectedRange: options.selectedRange,
            selectedSource: options.selectedSource,
            sql: draftResult.draft.sql,
          });
          if (executionResult === "executed") {
            return "executed";
          }
          if (executionResult === "change-mode") {
            return "change-mode";
          }
          if (executionResult === "cancel") {
            return "cancel";
          }
          if (executionResult === "regenerate") {
            continue;
          }
          if (executionResult === "revise") {
            break;
          }
        }
      } finally {
        status.stop();
      }

      const nextStep = await select<"regenerate" | "revise" | "cancel">({
        message: "Codex Assistant next step",
        choices: [
          { name: "regenerate SQL", value: "regenerate" },
          { name: "revise intent", value: "revise" },
          { name: "cancel", value: "cancel" },
        ],
      });
      if (nextStep === "regenerate") {
        continue;
      }
      if (nextStep === "cancel") {
        return "cancel";
      }
      break;
    }
  }
}
