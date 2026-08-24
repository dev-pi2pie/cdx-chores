import { confirm, select } from "@inquirer/prompts";

import {
  resolveMarkdownPdfRenderOutput,
  type ResolvedMarkdownPdfRenderOutput,
} from "../../../actions/markdown/to-pdf-service";
import { displayPath, printLine } from "../../../actions/shared";
import { promptRequiredPathWithConfig } from "../../../prompts/path";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { suggestedMarkdownPdfCodexOutputPath } from "../codex-service";
import type { MarkdownPdfGeneratedLifecycleSelection } from "../codex-types";
import type { BoundMarkdownPdfGeneratedMaterialization } from "../materialization";
import { artifactLabel, isRecoverableGeneratedLifecycleBindError } from "./guards";
import {
  formatEffectiveMarkdownPdfCodeReview,
  formatMarkdownPdfRenderOverrideReview,
  formatReusableMarkdownPdfCodeReview,
  resolveGeneratedEffectiveMarkdownPdfCode,
  resolveGeneratedReusableMarkdownPdfCode,
} from "../code-highlighting-review";
import type { MarkdownPdfRenderCodeHighlightChoice } from "../render-code-highlighting";
import {
  formatMarkdownPdfPageNumberConfigurationReview,
  resolveGeneratedMarkdownPdfPageNumberConfiguration,
} from "../page-number-review";
import type { MarkdownPdfRenderPageNumberChoice } from "../render-page-numbers";

export type ArtifactDestinationOutcome =
  | { kind: "destination"; output: string; overwrite: boolean }
  | { kind: "review" }
  | { kind: "cancel" };

export type FinalRenderNextStep =
  | "outputs"
  | "change-code-highlighting"
  | "change-page-numbers"
  | "review"
  | "cancel";

export type PdfOutputOutcome =
  | { kind: "output"; output: ResolvedMarkdownPdfRenderOutput }
  | { kind: "review" }
  | { kind: "cancel" };

export async function promptArtifactDestination(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfGeneratedLifecycleSelection,
): Promise<ArtifactDestinationOutcome> {
  const candidate = selection.candidate;
  let output: string;
  if (candidate.kind === "deterministic") {
    const action = await select<"custom" | "review" | "cancel">({
      message: `${artifactLabel(selection)} output destination`,
      choices: [
        { name: "Choose output", value: "custom" },
        { name: "Back to recipe review", value: "review" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (action !== "custom") {
      return { kind: action };
    }
    output = await promptRequiredPathWithConfig(
      candidate.candidate.artifact === "profile"
        ? "Profile output file"
        : "Template output directory",
      {
        kind: candidate.candidate.artifact === "profile" ? "file" : "directory",
        ...pathPromptContext,
      },
    );
  } else {
    const action = await select<"suggested" | "custom" | "review" | "cancel">({
      message: `${artifactLabel(selection)} output destination`,
      choices: [
        {
          name: "Use generated output",
          value: "suggested",
          description: "Resolve a non-conflicting destination",
        },
        { name: "Custom output", value: "custom" },
        { name: "Back to recipe review", value: "review" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (action === "review" || action === "cancel") {
      return { kind: action };
    }
    output =
      action === "custom"
        ? await promptRequiredPathWithConfig(
            candidate.candidate.artifact === "profile"
              ? "Profile output file"
              : "Bundle output directory",
            {
              kind: candidate.candidate.artifact === "profile" ? "file" : "directory",
              ...pathPromptContext,
            },
          )
        : await suggestedMarkdownPdfCodexOutputPath(candidate.candidate);
  }
  const overwrite = await confirm({
    message: "Overwrite recipe output if it exists?",
    default: false,
  });
  return { kind: "destination", output, overwrite };
}

export async function promptGeneratedPdfOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  inputPath: string,
): Promise<PdfOutputOutcome> {
  while (true) {
    const destination = await select<"default" | "custom" | "review" | "cancel">({
      message: "PDF output destination",
      choices: [
        { name: "Use default output", value: "default" },
        { name: "Custom output path", value: "custom" },
        { name: "Back to recipe review", value: "review" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (destination === "review" || destination === "cancel") {
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
      return {
        kind: "output",
        output: await resolveMarkdownPdfRenderOutput(runtime, inputPath, { output, overwrite }),
      };
    } catch (error) {
      if (!isRecoverableGeneratedLifecycleBindError(error)) {
        throw error;
      }
      printLine(runtime.stderr, `Unable to prepare PDF output: ${error.message}`);
    }
  }
}

export async function promptGeneratedFinalRenderNextStep(
  options: { durableRecipeWritten?: boolean } = {},
): Promise<FinalRenderNextStep> {
  return await select<FinalRenderNextStep>({
    message: "Final render next step",
    choices: [
      {
        name: options.durableRecipeWritten ? "Change PDF output" : "Change outputs",
        value: "outputs",
      },
      { name: "Change code highlighting", value: "change-code-highlighting" },
      { name: "Change page numbers", value: "change-page-numbers" },
      { name: "Back to recipe review", value: "review" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

export function renderGeneratedFinalReview(
  runtime: CliRuntime,
  selection: MarkdownPdfGeneratedLifecycleSelection,
  pdf: ResolvedMarkdownPdfRenderOutput,
  materialization?: BoundMarkdownPdfGeneratedMaterialization,
  codeHighlight: MarkdownPdfRenderCodeHighlightChoice = selection.codeHighlight,
  pageNumbers: MarkdownPdfRenderPageNumberChoice = selection.pageNumbers,
): void {
  printLine(runtime.stderr, "Final render review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Input: ${displayPath(runtime, selection.markdownInput)}`);
  printLine(runtime.stderr, `Artifact: ${artifactLabel(selection)}`);
  printLine(
    runtime.stderr,
    selection.lifecycle === "temporary-render"
      ? "Recipe output: CLI-owned temporary session"
      : `Recipe output: ${displayPath(runtime, materialization!.destination)}`,
  );
  printLine(runtime.stderr, `PDF output: ${displayPath(runtime, pdf.outputPath)}`);
  printLine(runtime.stderr, `Codex report: ${selection.report.kind}`);
  printLine(
    runtime.stderr,
    `Recipe cleanup: ${selection.lifecycle === "temporary-render" ? "after successful render" : "never"}`,
  );
  printLine(runtime.stderr, `PDF overwrite: ${pdf.overwrite ? "enabled" : "disabled"}`);
  const reusable = resolveGeneratedReusableMarkdownPdfCode(selection.candidate);
  if (reusable) {
    printLine(runtime.stderr, "");
    for (const line of formatReusableMarkdownPdfCodeReview(reusable)) {
      printLine(runtime.stderr, line);
    }
  }
  printLine(runtime.stderr, "");
  for (const line of formatMarkdownPdfRenderOverrideReview(codeHighlight)) {
    printLine(runtime.stderr, line);
  }
  printLine(runtime.stderr, "");
  for (const line of formatEffectiveMarkdownPdfCodeReview(
    resolveGeneratedEffectiveMarkdownPdfCode(selection.candidate, codeHighlight),
  )) {
    printLine(runtime.stderr, line);
  }
  printLine(runtime.stderr, "");
  for (const line of formatMarkdownPdfPageNumberConfigurationReview(
    resolveGeneratedMarkdownPdfPageNumberConfiguration(selection.candidate, pageNumbers),
  )) {
    printLine(runtime.stderr, line);
  }
}
