import { confirm, select } from "@inquirer/prompts";

import {
  bindResolvedMarkdownPdfRenderOutput,
  executePlannedMarkdownPdfRender,
  prepareMarkdownPdfRender,
  type PlannedMarkdownPdfRender,
  type ResolvedMarkdownPdfRenderOutput,
} from "../../../actions/markdown/to-pdf-service";
import { displayPath, printLine } from "../../../actions/shared";
import type { CliRuntime } from "../../../types";
import type { MarkdownPdfGeneratedLifecycleSelection } from "../codex-types";
import { assertPdfOutputDoesNotAliasMaterializedOutput } from "./guards";
import {
  cleanupOwnedMarkdownPdfSession,
  retainOwnedMarkdownPdfSession,
  type OwnedMarkdownPdfSession,
} from "../lifecycle";
import {
  writeBoundMarkdownPdfGeneratedCandidate,
  type BoundMarkdownPdfGeneratedMaterialization,
} from "../materialization";

export type GeneratedLifecycleOutcome = "complete" | "review";

type DurableRecoveryStage = "materialization" | "renderer-preparation";

export interface DurableMaterializationWriteState {
  isWritten: boolean;
}

function printRenderWarnings(runtime: CliRuntime, warnings: readonly string[]): void {
  if (warnings.length === 0) {
    return;
  }
  printLine(runtime.stderr, "Markdown PDF render warnings:");
  for (const warning of warnings) {
    printLine(runtime.stderr, `- ${warning}`);
  }
}

export function printRetainedSession(runtime: CliRuntime, session: OwnedMarkdownPdfSession): void {
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Temporary recipe session retained:");
  printLine(runtime.stderr, session.path);
}

function printRetainedDurableRecipe(
  runtime: CliRuntime,
  materialization: Extract<BoundMarkdownPdfGeneratedMaterialization, { kind: "durable" }>,
): void {
  printLine(
    runtime.stderr,
    `Durable recipe retained: ${displayPath(runtime, materialization.destination)}`,
  );
}

async function promptDurableRecovery(
  stage: DurableRecoveryStage,
): Promise<"retry" | "review" | "exit"> {
  return await select<"retry" | "review" | "exit">({
    message:
      stage === "materialization" ? "Durable recipe recovery" : "Renderer preparation recovery",
    choices: [
      {
        name: stage === "materialization" ? "Retry materialization" : "Retry renderer preparation",
        value: "retry",
      },
      { name: "Revise recipe", value: "review" },
      { name: "Exit", value: "exit" },
    ],
  });
}

export async function recoverRetainedSession(
  runtime: CliRuntime,
  session: OwnedMarkdownPdfSession,
  allowRetry: boolean,
): Promise<"retry" | GeneratedLifecycleOutcome> {
  while (true) {
    const action = await select<"retry" | "review" | "keep" | "delete">({
      message: allowRetry ? "Render recovery" : "Materialization recovery",
      choices: [
        ...(allowRetry ? [{ name: "Retry render", value: "retry" as const }] : []),
        { name: "Keep session and revise recipe", value: "review" },
        { name: "Keep session and exit", value: "keep" },
        { name: "Delete session and exit", value: "delete" },
      ],
    });
    if (action === "retry") {
      return "retry";
    }
    if (action === "review") {
      retainOwnedMarkdownPdfSession(session);
      return "review";
    }
    if (action === "keep") {
      retainOwnedMarkdownPdfSession(session);
      return "complete";
    }
    if (
      await confirm({
        message: "Delete this exact temporary recipe session?",
        default: false,
      })
    ) {
      await cleanupOwnedMarkdownPdfSession(session);
      return "complete";
    }
  }
}

export async function executeRenderWithRecovery(
  runtime: CliRuntime,
  plan: PlannedMarkdownPdfRender,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
): Promise<GeneratedLifecycleOutcome> {
  while (true) {
    try {
      const result = await executePlannedMarkdownPdfRender(runtime, plan);
      printRenderWarnings(runtime, result.warnings);
      printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, plan.outputPath)}`);
      if (materialization.kind === "temporary") {
        try {
          await cleanupOwnedMarkdownPdfSession(materialization.session);
        } catch (error) {
          printLine(
            runtime.stderr,
            `Unable to remove the temporary recipe session: ${error instanceof Error ? error.message : String(error)}`,
          );
          printRetainedSession(runtime, materialization.session);
        }
      }
      return "complete";
    } catch (error) {
      printLine(
        runtime.stderr,
        `Rendering failed before a PDF was completed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (materialization.kind === "durable") {
        const next = await select<"retry" | "review" | "exit">({
          message: "Render recovery",
          choices: [
            { name: "Retry render", value: "retry" },
            { name: "Revise recipe", value: "review" },
            { name: "Exit", value: "exit" },
          ],
        });
        if (next === "retry") {
          continue;
        }
        return next === "review" ? "review" : "complete";
      }
      printRetainedSession(runtime, materialization.session);
      const next = await recoverRetainedSession(runtime, materialization.session, true);
      if (next === "retry") {
        continue;
      }
      return next;
    }
  }
}

export async function executeDurableMaterializationAndRender(
  runtime: CliRuntime,
  selection: MarkdownPdfGeneratedLifecycleSelection,
  pdf: ResolvedMarkdownPdfRenderOutput,
  materialization: Extract<BoundMarkdownPdfGeneratedMaterialization, { kind: "durable" }>,
  writeState: DurableMaterializationWriteState,
  codeHighlight?: boolean,
  pageNumbers?: boolean,
): Promise<GeneratedLifecycleOutcome> {
  while (true) {
    if (!writeState.isWritten) {
      try {
        await writeBoundMarkdownPdfGeneratedCandidate(materialization);
        writeState.isWritten = true;
      } catch (error) {
        printLine(
          runtime.stderr,
          `Unable to materialize the durable recipe: ${error instanceof Error ? error.message : String(error)}`,
        );
        printRetainedDurableRecipe(runtime, materialization);
        const next = await promptDurableRecovery("materialization");
        if (next === "retry") {
          continue;
        }
        return next === "review" ? "review" : "complete";
      }
    }

    try {
      await assertPdfOutputDoesNotAliasMaterializedOutput(
        runtime,
        pdf.outputPath,
        materialization,
        selection.report,
      );
      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: selection.markdownInput,
        ...materialization.rendererSource,
        ...(codeHighlight === undefined ? {} : { codeHighlight }),
        ...(pageNumbers === undefined ? {} : { pageNumbers }),
      });
      return await executeRenderWithRecovery(
        runtime,
        bindResolvedMarkdownPdfRenderOutput(prepared, pdf),
        materialization,
      );
    } catch (error) {
      printLine(
        runtime.stderr,
        `Unable to prepare the renderer from the durable recipe: ${error instanceof Error ? error.message : String(error)}`,
      );
      printRetainedDurableRecipe(runtime, materialization);
      const next = await promptDurableRecovery("renderer-preparation");
      if (next === "retry") {
        continue;
      }
      return next === "review" ? "review" : "complete";
    }
  }
}
