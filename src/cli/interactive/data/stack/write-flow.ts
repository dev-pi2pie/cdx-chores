import { stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm, select } from "@inquirer/prompts";

import { writePreparedDataStackPlan } from "../../../actions";
import { displayPath, printLine } from "../../../actions/shared";
import { createDataStackDefaultOutputPath } from "../../../data-stack/default-output";
import { generateDataStackPlanFileName } from "../../../data-stack/plan";
import type { DataStackOutputFormat } from "../../../data-stack/types";
import { resolveFromCwd } from "../../../path-utils";
import { promptOptionalOutputPathChoice } from "../../../prompts/path";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import {
  assertInteractiveStackPlanPathDoesNotOverlapInputs,
  assertInteractiveStackPlanPathIsReplayable,
  buildInteractiveStackPlanWriteInput,
  maybeKeepInteractiveStackPlan,
  promptInteractiveStackPlanPath,
  resolveInteractiveStackReportPersistence,
} from "./artifacts";
import {
  createInteractiveStackCodexSignalKey,
  getInteractiveStackCodexAssistSignals,
  promptInteractiveStackCodexCheckpoint,
  requestInteractiveStackCodexReview,
} from "./codex-review";
import {
  prepareInteractiveStackPreviewState,
  renderInteractiveStackReview,
  renderInteractiveStackStatusPreview,
} from "./review";
import type {
  InteractiveDataStackSetup,
  InteractiveDataStackReviewedPlan,
  InteractiveDataStackWriteOutcome,
  InteractiveDataStackWritePlan,
} from "./types";

async function promptInteractiveStackOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveDataStackWritePlan> {
  const outputFormat = await select<DataStackOutputFormat>({
    message: "Output format",
    choices: [
      { name: "CSV", value: "csv" },
      { name: "TSV", value: "tsv" },
      { name: "JSON", value: "json" },
    ],
  });

  while (true) {
    const fallbackOutputPath = createDataStackDefaultOutputPath(runtime, outputFormat);
    const chosenOutputPath = await promptOptionalOutputPathChoice({
      message: `Output ${outputFormat.toUpperCase()} file`,
      defaultHint: fallbackOutputPath,
      kind: "file",
      ...pathPromptContext,
      customMessage: `Custom ${outputFormat.toUpperCase()} output path`,
    });
    const output = chosenOutputPath ?? fallbackOutputPath;

    if (extname(output).toLowerCase() !== `.${outputFormat}`) {
      printLine(runtime.stdout, `Output file must end with .${outputFormat}.`);
      continue;
    }

    try {
      await stat(resolveFromCwd(runtime, output));
      const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
      if (overwrite) {
        return { output, outputFormat, overwrite };
      }
      printLine(runtime.stdout, "Choose a different output destination.");
    } catch {
      return { output, outputFormat, overwrite: false };
    }
  }
}

export function renderSkippedInteractiveStackWrite(runtime: CliRuntime): void {
  printLine(runtime.stderr, "Skipped stack write.");
}

export async function confirmInteractiveStackWrite(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  setup: InteractiveDataStackSetup,
): Promise<InteractiveDataStackWriteOutcome> {
  let outputPlan = await promptInteractiveStackOutput(runtime, pathPromptContext);
  let reviewedPlan: InteractiveDataStackReviewedPlan | undefined;
  let handledCodexSignalKey: string | undefined;

  while (true) {
    const outputPath = resolveFromCwd(runtime, outputPlan.output);
    const defaultPlanPath = generateDataStackPlanFileName(runtime.now());
    const state = await prepareInteractiveStackPreviewState({
      outputPath,
      outputPlan,
      planArtifact: reviewedPlan?.plan,
      runtime,
      setup,
    });

    renderInteractiveStackReview(runtime, {
      ...setup,
      ...outputPlan,
      prepared: state.prepared,
      requestedSchemaMode: state.requestedSchemaMode,
      schemaMode: state.prepared.schemaMode,
    });
    renderInteractiveStackStatusPreview(runtime, {
      diagnostics: state.diagnostics,
      plan: reviewedPlan?.plan,
      planPath: defaultPlanPath,
      prepared: state.prepared,
    });

    const codexSignals = getInteractiveStackCodexAssistSignals(state);
    const codexSignalKey = createInteractiveStackCodexSignalKey(state, codexSignals);
    const hasReviewedCodexChanges =
      (state.planArtifact?.metadata.recommendationDecisions.length ?? 0) > 0;
    if (
      codexSignals.length > 0 &&
      handledCodexSignalKey !== codexSignalKey &&
      !hasReviewedCodexChanges
    ) {
      const checkpointAction = await promptInteractiveStackCodexCheckpoint(runtime, codexSignals);
      if (checkpointAction === "codex") {
        handledCodexSignalKey = codexSignalKey;
        reviewedPlan = await requestInteractiveStackCodexReview(runtime, state);
        continue;
      }
      if (checkpointAction === "review") {
        return { kind: "review" };
      }
      if (checkpointAction === "cancel") {
        renderSkippedInteractiveStackWrite(runtime);
        return { kind: "cancel" };
      }
      handledCodexSignalKey = codexSignalKey;
    }

    const nextStep = await select<"write" | "dry-run" | "review" | "destination" | "cancel">({
      message: "Stack plan action",
      choices: [
        {
          name: "Write now",
          value: "write",
          description: "Write the stacked output and save this stack plan first",
        },
        {
          name: "Dry-run plan only",
          value: "dry-run",
          description: "Save a replayable stack plan without writing stacked output",
        },
        {
          name: "Revise setup",
          value: "review",
          description: "Choose a different source, pattern, traversal, or schema mode",
        },
        {
          name: "Change destination",
          value: "destination",
          description: "Keep the current stack setup and adjust only the output destination",
        },
        {
          name: "Cancel",
          value: "cancel",
          description: "Stop before writing the stacked output",
        },
      ],
    });
    if (nextStep === "write") {
      const planPath = resolveFromCwd(runtime, defaultPlanPath);
      assertInteractiveStackPlanPathIsReplayable({ outputPath, planPath, runtime });
      assertInteractiveStackPlanPathDoesNotOverlapInputs({
        planPath,
        prepared: state.prepared,
        runtime,
      });
      const writeInput = await resolveInteractiveStackReportPersistence(
        runtime,
        state,
        reviewedPlan,
      );
      const planArtifact = await writePreparedDataStackPlan(
        runtime,
        buildInteractiveStackPlanWriteInput(writeInput.state, planPath, writeInput.reviewedPlan),
      );
      return {
        diagnostics: state.diagnostics,
        kind: "write",
        outputPath,
        plan: outputPlan,
        planArtifact,
        planPath,
        prepared: state.prepared,
      };
    }
    if (nextStep === "dry-run") {
      const chosenPlanPath = resolveFromCwd(
        runtime,
        await promptInteractiveStackPlanPath(runtime, pathPromptContext),
      );
      assertInteractiveStackPlanPathIsReplayable({
        outputPath,
        planPath: chosenPlanPath,
        runtime,
      });
      assertInteractiveStackPlanPathDoesNotOverlapInputs({
        planPath: chosenPlanPath,
        prepared: state.prepared,
        runtime,
      });
      const writeInput = await resolveInteractiveStackReportPersistence(
        runtime,
        state,
        reviewedPlan,
      );
      await writePreparedDataStackPlan(
        runtime,
        buildInteractiveStackPlanWriteInput(
          writeInput.state,
          chosenPlanPath,
          writeInput.reviewedPlan,
        ),
      );
      printLine(
        runtime.stderr,
        `Dry run: wrote stack plan ${displayPath(runtime, chosenPlanPath)}`,
      );
      await maybeKeepInteractiveStackPlan(runtime, chosenPlanPath);
      return { kind: "dry-run" };
    }
    if (nextStep === "review") {
      return { kind: "review" };
    }
    if (nextStep === "cancel") {
      renderSkippedInteractiveStackWrite(runtime);
      return { kind: "cancel" };
    }

    outputPlan = await promptInteractiveStackOutput(runtime, pathPromptContext);
  }
}
