import { confirm, select } from "@inquirer/prompts";

import {
  planMarkdownPdfRender,
  type PlannedMarkdownPdfRender,
  type executePlannedMarkdownPdfRender,
} from "../../../actions/markdown/to-pdf-service";
import { displayPath, printLine } from "../../../actions/shared";
import { formatDefaultOutputPathHint, promptRequiredPathWithConfig } from "../../../prompts/path";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import {
  formatEffectiveMarkdownPdfCodeReview,
  formatMarkdownPdfRenderOverrideReview,
  formatReusableMarkdownPdfCodeReview,
} from "../code-highlighting-review";
import { isRecoverableGeneratedLifecycleBindError } from "../generated-lifecycle/guards";
import { formatMarkdownPdfPageNumberReview } from "../page-number-review";
import type { MarkdownPdfInteractivePreparedRenderSource } from "../render-source";

export type MarkdownPdfOutputSelection =
  | { kind: "plan"; plan: PlannedMarkdownPdfRender }
  | { kind: "change-code-highlighting" }
  | { kind: "change-page-numbers" }
  | { kind: "change-source" }
  | { kind: "cancel" };

export async function promptMarkdownPdfOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfInteractivePreparedRenderSource,
): Promise<MarkdownPdfOutputSelection> {
  while (true) {
    const defaultHint = formatDefaultOutputPathHint(runtime, selection.prepared.inputPath, ".pdf");
    const destination = await select<
      | "default"
      | "custom"
      | "change-code-highlighting"
      | "change-page-numbers"
      | "change-source"
      | "cancel"
    >({
      message: "PDF output destination",
      choices: [
        {
          name: "Use default output",
          value: "default",
          description: defaultHint,
        },
        {
          name: "Custom output path",
          value: "custom",
          description: "Choose where to write the PDF",
        },
        {
          name: "Change code highlighting",
          value: "change-code-highlighting",
        },
        ...(selection.pageNumbers === undefined
          ? []
          : [{ name: "Change page numbers", value: "change-page-numbers" as const }]),
        { name: "Change recipe source", value: "change-source" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (
      destination === "change-code-highlighting" ||
      destination === "change-page-numbers" ||
      destination === "change-source" ||
      destination === "cancel"
    ) {
      return { kind: destination };
    }

    const output =
      destination === "custom"
        ? await promptRequiredPathWithConfig("Custom PDF output path", {
            kind: "file",
            ...pathPromptContext,
          })
        : undefined;
    const overwrite = await confirm({ message: "Overwrite PDF if it exists?", default: false });
    try {
      const plan = await planMarkdownPdfRender(runtime, selection.prepared, {
        output,
        overwrite,
      });
      return { kind: "plan", plan };
    } catch (error) {
      if (!isRecoverableGeneratedLifecycleBindError(error)) {
        throw error;
      }
      printLine(runtime.stderr, `Unable to prepare PDF output: ${error.message}`);
    }
  }
}

export function renderMarkdownPdfFinalReview(
  runtime: CliRuntime,
  selection: MarkdownPdfInteractivePreparedRenderSource,
  plan: PlannedMarkdownPdfRender,
): void {
  printLine(runtime.stderr, "Final render review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Input: ${displayPath(runtime, selection.prepared.inputPath)}`);
  printLine(runtime.stderr, `PDF output: ${displayPath(runtime, plan.outputPath)}`);
  printLine(runtime.stderr, `Overwrite: ${plan.overwrite ? "enabled" : "disabled"}`);
  printLine(runtime.stderr, "Existing recipe cleanup: never");
  if (selection.prepared.resolvedInputs.profile) {
    printLine(runtime.stderr, "");
    for (const line of formatReusableMarkdownPdfCodeReview(
      selection.prepared.normalizedProfile.code,
    )) {
      printLine(runtime.stderr, line);
    }
  }
  printLine(runtime.stderr, "");
  for (const line of formatMarkdownPdfRenderOverrideReview(selection.codeHighlight)) {
    printLine(runtime.stderr, line);
  }
  printLine(runtime.stderr, "");
  for (const line of formatEffectiveMarkdownPdfCodeReview(selection.prepared.code)) {
    printLine(runtime.stderr, line);
  }
  if (selection.pageNumbers !== undefined) {
    printLine(runtime.stderr, "");
    for (const line of formatMarkdownPdfPageNumberReview(selection.prepared)) {
      printLine(runtime.stderr, line);
    }
  }
}

export async function promptDeclinedRenderAction(
  pageNumberChangeAvailable: boolean,
): Promise<
  "change-output" | "change-code-highlighting" | "change-page-numbers" | "change-source" | "cancel"
> {
  return await select<
    | "change-output"
    | "change-code-highlighting"
    | "change-page-numbers"
    | "change-source"
    | "cancel"
  >({
    message: "Final render next step",
    choices: [
      { name: "Change PDF output", value: "change-output" },
      { name: "Change code highlighting", value: "change-code-highlighting" },
      ...(pageNumberChangeAvailable
        ? [{ name: "Change page numbers", value: "change-page-numbers" as const }]
        : []),
      { name: "Change recipe source", value: "change-source" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

export function renderMarkdownPdfRendererCapabilityAssessment(
  runtime: CliRuntime,
  assessment: Awaited<ReturnType<typeof executePlannedMarkdownPdfRender>>["rendererCapabilities"],
  requests: MarkdownPdfInteractivePreparedRenderSource["prepared"]["rendererCapabilityRequests"],
): void {
  const requestedCapabilityIds = new Set(requests.map((request) => request.capabilityId));
  const capabilities = assessment.capabilities.filter((capability) =>
    requestedCapabilityIds.has(capability.id),
  );
  if (capabilities.length === 0) {
    return;
  }
  printLine(runtime.stderr, "Markdown PDF renderer capability assessment:");
  const rendererStatus =
    assessment.renderer.available === true
      ? `installed (${assessment.renderer.version ?? "unknown version"})`
      : assessment.renderer.available === false
        ? "missing"
        : "unverified";
  printLine(runtime.stderr, `- ${assessment.renderer.name}: ${rendererStatus}`);
  for (const capability of capabilities) {
    const diagnostic = capability.diagnosticConditionId
      ? `, diagnostic=${capability.diagnosticConditionId}`
      : "";
    printLine(
      runtime.stderr,
      `- ${capability.id}: ${capability.status}, minimum=${capability.minimumVersion}${diagnostic}`,
    );
  }
}
