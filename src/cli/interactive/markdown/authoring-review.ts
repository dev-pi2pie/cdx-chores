import { displayPath, printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import type {
  MarkdownPdfDeterministicArtifact,
  PreparedMarkdownPdfDeterministicRecipe,
} from "./deterministic-authoring";
import type { MarkdownPdfInteractiveEntry } from "./types";
import { renderReusableMarkdownPdfCodeReview } from "./code-highlighting-review";
import {
  collectMarkdownPdfProfileAuthoringReview,
  formatMarkdownPdfProfileAuthoringReview,
} from "../../markdown-pdf/profile-authoring-review";
import { collectMarkdownPdfOccupiedPageNumberSlotDiagnostic } from "../../markdown-pdf/diagnostics";

export type MarkdownPdfCandidateReviewAction =
  | "save"
  | "temporary-render"
  | "save-and-render"
  | "revise-layout"
  | "revise-margins"
  | "revise-toc"
  | "revise-code"
  | "revise-page-chrome"
  | "revise-page-numbers"
  | "change-mode"
  | "change-artifact"
  | "cancel";

export const MARKDOWN_PDF_ARTIFACT_LABELS: Record<MarkdownPdfDeterministicArtifact, string> = {
  profile: "Profile",
  "template-bundle": "Template bundle",
};

function formatMargins(candidate: PreparedMarkdownPdfDeterministicRecipe): string {
  const { top, right, bottom, left } = candidate.prepared.normalizedOptions.margins;
  return top === right && top === bottom && top === left
    ? top
    : `${top} ${right} ${bottom} ${left}`;
}

export function renderDeterministicRecipeReview(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfDeterministicRecipe,
  markdownInput?: string,
): void {
  const options = candidate.prepared.normalizedOptions;
  printLine(runtime.stderr, "Markdown PDF recipe review");
  printLine(runtime.stderr, "");
  if (markdownInput) {
    printLine(runtime.stderr, `Input: ${markdownInput}`);
  }
  printLine(runtime.stderr, `Artifact: ${MARKDOWN_PDF_ARTIFACT_LABELS[candidate.artifact]}`);
  printLine(runtime.stderr, `Preparation mode: ${candidate.preparation}`);
  printLine(runtime.stderr, "Validation: passed");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Effective recipe:");
  printLine(runtime.stderr, `- Preset: ${options.preset}`);
  printLine(runtime.stderr, `- Page: ${options.pageSize} ${options.orientation}`);
  printLine(runtime.stderr, `- Margins: ${formatMargins(candidate)}`);
  printLine(
    runtime.stderr,
    `- ToC: ${options.toc ? `enabled (depth ${options.tocDepth}, page break ${options.tocPageBreak})` : "disabled"}`,
  );
  if (candidate.artifact === "profile") {
    const review = collectMarkdownPdfProfileAuthoringReview(candidate.prepared.profile);
    printLine(runtime.stderr, "");
    renderReusableMarkdownPdfCodeReview(runtime, review.normalizedProfile.code);
    for (const line of formatMarkdownPdfProfileAuthoringReview(review)) {
      printLine(runtime.stderr, line);
    }
    const occupiedSlot = collectMarkdownPdfOccupiedPageNumberSlotDiagnostic({
      profile: review.normalizedProfile,
      pageNumbers: review.normalizedProfile.pageNumbers,
    });
    if (occupiedSlot) {
      printLine(runtime.stderr, "");
      printLine(runtime.stderr, `Warning: ${occupiedSlot.message}`);
    }
  }
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Planned recipe files:");
  if (candidate.artifact === "profile") {
    printLine(runtime.stderr, "- profile.yml or profile.json (selected at save time)");
  } else {
    printLine(runtime.stderr, "- template.html");
    printLine(runtime.stderr, "- style.css");
  }
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Dry run: no files have been written.");
}

export function markdownPdfCandidateReviewChoices(
  entry: MarkdownPdfInteractiveEntry,
  candidate: PreparedMarkdownPdfDeterministicRecipe,
) {
  const label = MARKDOWN_PDF_ARTIFACT_LABELS[candidate.artifact].toLowerCase();
  const acceptChoices =
    entry === "pdf-recipes"
      ? [
          {
            name: `Save ${label}`,
            value: "save" as const,
            description: "Choose the required durable output and save",
          },
        ]
      : [
          {
            name: `Render with temporary ${label}`,
            value: "temporary-render" as const,
            description: "Remove the generated artifact after a successful render",
          },
          {
            name: `Save ${label} and render`,
            value: "save-and-render" as const,
            description: "Keep the generated artifact after rendering",
          },
        ];
  const commonRevisionChoices =
    candidate.preparation === "formal-guide"
      ? ([
          { name: "Revise layout", value: "revise-layout" },
          { name: "Revise margins", value: "revise-margins" },
          { name: "Revise table of contents", value: "revise-toc" },
        ] as const)
      : [];
  const codeRevisionChoices =
    candidate.preparation === "formal-guide" && candidate.artifact === "profile"
      ? ([{ name: "Revise code highlighting", value: "revise-code" }] as const)
      : [];
  const profileRevisionChoices =
    candidate.preparation === "formal-guide" && candidate.artifact === "profile"
      ? ([
          { name: "Revise page numbers", value: "revise-page-numbers" },
          { name: "Revise page chrome", value: "revise-page-chrome" },
        ] as const)
      : [];
  return [
    ...acceptChoices,
    ...commonRevisionChoices,
    ...codeRevisionChoices,
    ...profileRevisionChoices,
    { name: "Change preparation mode", value: "change-mode" as const },
    { name: "Change artifact", value: "change-artifact" as const },
    { name: "Cancel", value: "cancel" as const },
  ];
}

export function renderFinalRecipeSaveReview(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfDeterministicRecipe,
  outputPath: string,
  outputFiles: readonly string[],
  overwrite: boolean,
): void {
  printLine(runtime.stderr, "Final recipe save review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Artifact: ${MARKDOWN_PDF_ARTIFACT_LABELS[candidate.artifact]}`);
  printLine(runtime.stderr, `Output: ${outputPath}`);
  if (outputFiles.length > 1) {
    printLine(runtime.stderr, "Files:");
    for (const file of outputFiles) {
      printLine(runtime.stderr, `- ${displayPath(runtime, file)}`);
    }
  }
  printLine(runtime.stderr, `Overwrite: ${overwrite ? "enabled" : "disabled"}`);
}
