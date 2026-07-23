import { confirm, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import type {
  MarkdownPdfCodexArtifact,
  MarkdownPdfCodexReportRetention,
  MarkdownPdfCodexSetup,
  PreparedMarkdownPdfCodexCandidate,
} from "./codex-types";
import type { MarkdownPdfInteractiveEntry } from "./types";
import { collectMarkdownPdfInteractiveFontReview } from "./font-review";
import {
  renderReusableMarkdownPdfCodeReview,
  tryResolveReusableMarkdownPdfCode,
} from "./code-highlighting-review";
import type { NormalizedMarkdownPdfCode } from "../../markdown-pdf/profile";

export type MarkdownPdfCodexReviewAction =
  | "save"
  | "temporary-render"
  | "save-and-render"
  | "regenerate"
  | "change-setup"
  | "change-artifact"
  | "cancel";

export const MARKDOWN_PDF_CODEX_ARTIFACT_LABELS: Record<MarkdownPdfCodexArtifact, string> = {
  profile: "Profile",
  "template-bundle": "Template bundle",
  "project-bundle": "Project bundle",
};

export function isUsableMarkdownPdfCodexCandidate(
  candidate: PreparedMarkdownPdfCodexCandidate,
): boolean {
  if (candidate.artifact === "profile") {
    return candidate.prepared.kind === "profile";
  }
  if (candidate.artifact === "template-bundle") {
    return candidate.prepared.synthesis.decisionMode !== "no-usable-template";
  }
  return candidate.prepared.binding.validation.decisionMode !== "no-usable-project";
}

function candidateDecision(candidate: PreparedMarkdownPdfCodexCandidate): string {
  if (candidate.artifact === "profile") {
    return candidate.prepared.kind === "profile"
      ? candidate.prepared.decisionMode
      : candidate.prepared.kind;
  }
  if (candidate.artifact === "template-bundle") {
    return candidate.prepared.synthesis.decisionMode;
  }
  return candidate.prepared.binding.validation.decisionMode;
}

function candidateSignalMode(candidate: PreparedMarkdownPdfCodexCandidate): string {
  if (candidate.artifact === "profile") {
    return candidate.prepared.kind === "profile"
      ? (candidate.prepared.signalMode ?? "not applicable")
      : "not applicable";
  }
  if (candidate.artifact === "template-bundle") {
    return candidate.prepared.signals.signalMode;
  }
  return candidate.prepared.signals.modes.project;
}

function plannedFiles(candidate: PreparedMarkdownPdfCodexCandidate): string[] {
  if (candidate.artifact === "profile") {
    return ["profile.yml or profile.json (selected at save time)"];
  }
  if (candidate.artifact === "template-bundle") {
    return [
      candidate.prepared.outputPlan.templateHtml.bundlePath,
      candidate.prepared.outputPlan.styleCss.bundlePath,
      ...candidate.prepared.outputPlan.assets.map((asset) => asset.bundlePath),
    ];
  }
  return [
    candidate.prepared.layout.profile.bundlePath,
    candidate.prepared.layout.templateHtml.bundlePath,
    candidate.prepared.layout.styleCss.bundlePath,
    ...candidate.prepared.layout.assets.map((asset) => asset.bundlePath),
  ];
}

function reusableCode(
  candidate: PreparedMarkdownPdfCodexCandidate,
): NormalizedMarkdownPdfCode | undefined {
  if (candidate.artifact === "profile") {
    return candidate.prepared.kind === "profile"
      ? tryResolveReusableMarkdownPdfCode(candidate.prepared.finalProfile)
      : undefined;
  }
  if (candidate.artifact === "template-bundle") {
    return undefined;
  }
  return tryResolveReusableMarkdownPdfCode(candidate.prepared.profilePhase.finalProfile);
}

export function renderMarkdownPdfCodexConsent(
  runtime: CliRuntime,
  setup: MarkdownPdfCodexSetup,
): void {
  printLine(runtime.stderr, "Codex Assistant preparation");
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `Markdown sample: ${setup.sample ? displayPath(runtime, setup.sample) : "none"}`,
  );
  printLine(runtime.stderr, `Creating: ${MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[setup.artifact]}`);
  printLine(runtime.stderr, `Intent: ${setup.intent ?? "none"}`);
  printLine(
    runtime.stderr,
    `Base profile: ${setup.baseProfile ? displayPath(runtime, setup.baseProfile) : "none"}`,
  );
  printLine(runtime.stderr, "Font hints:");
  if (setup.fontHints.length === 0) {
    printLine(runtime.stderr, "- none");
  } else {
    for (const hint of setup.fontHints) {
      printLine(runtime.stderr, `- ${hint}`);
    }
  }
  if (setup.artifact !== "profile") {
    printLine(
      runtime.stderr,
      `Cover image: ${setup.coverImage ? displayPath(runtime, setup.coverImage) : "none"}`,
    );
  }
  printLine(runtime.stderr, "Signals: bounded document structure, content hints, and user choices");
  printLine(
    runtime.stderr,
    `Codex requests: ${setup.artifact === "project-bundle" ? "coordinated Profile and Template phases" : "one helper preparation"}`,
  );
}

export async function confirmMarkdownPdfCodexConsent(
  runtime: CliRuntime,
  setup: MarkdownPdfCodexSetup,
): Promise<boolean> {
  renderMarkdownPdfCodexConsent(runtime, setup);
  return await confirm({
    message: "Send this intent and prepared document signals to Codex Assistant?",
    default: true,
  });
}

export function renderMarkdownPdfCodexCandidateReview(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfCodexCandidate,
): void {
  printLine(runtime.stderr, "Markdown PDF recipe review");
  printLine(runtime.stderr, "");
  if (candidate.setup.sample) {
    printLine(runtime.stderr, `Input: ${displayPath(runtime, candidate.setup.sample)}`);
  }
  printLine(runtime.stderr, `Artifact: ${MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[candidate.artifact]}`);
  printLine(runtime.stderr, "Preparation mode: Codex Assistant");
  printLine(runtime.stderr, `Signal mode: ${candidateSignalMode(candidate)}`);
  printLine(runtime.stderr, `Decision: ${candidateDecision(candidate)}`);
  printLine(
    runtime.stderr,
    `Codex request: ${isUsableMarkdownPdfCodexCandidate(candidate) ? "completed" : "no usable candidate"}`,
  );
  const fontReview = collectMarkdownPdfInteractiveFontReview(candidate);
  if (fontReview.applied.length > 0) {
    printLine(runtime.stderr, "");
    printLine(runtime.stderr, "Applied font mappings:");
    for (const mapping of fontReview.applied) {
      printLine(
        runtime.stderr,
        `- ${mapping.layer} ${mapping.role}/${mapping.key} → ${mapping.family}`,
      );
    }
  }
  if (fontReview.blocked.length > 0) {
    printLine(runtime.stderr, "");
    printLine(runtime.stderr, "Blocked font mappings:");
    for (const mapping of fontReview.blocked) {
      printLine(
        runtime.stderr,
        `- ${mapping.layer} ${mapping.role}/${mapping.key} → ${mapping.family} (${mapping.reason})`,
      );
    }
  }
  if (fontReview.unresolved.length > 0) {
    printLine(runtime.stderr, "");
    printLine(runtime.stderr, "Unresolved directions:");
    for (const direction of fontReview.unresolved) {
      printLine(runtime.stderr, `- ${direction}`);
    }
  }
  const code = reusableCode(candidate);
  if (code) {
    printLine(runtime.stderr, "");
    renderReusableMarkdownPdfCodeReview(runtime, code);
  }
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Planned recipe files:");
  for (const file of plannedFiles(candidate)) {
    printLine(runtime.stderr, `- ${file}`);
  }
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Dry run: no files have been written.");
}

export function markdownPdfCodexReviewChoices(
  entry: MarkdownPdfInteractiveEntry,
  candidate: PreparedMarkdownPdfCodexCandidate,
) {
  const usable = isUsableMarkdownPdfCodexCandidate(candidate);
  const label = MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[candidate.artifact].toLowerCase();
  const acceptance = !usable
    ? []
    : entry === "pdf-recipes"
      ? [{ name: `Save ${label}`, value: "save" as const }]
      : [
          {
            name: `Render with temporary ${label}`,
            value: "temporary-render" as const,
            description: "Remove it after success; retain it if rendering fails",
          },
          {
            name: `Save ${label} and render`,
            value: "save-and-render" as const,
            description: "Keep the generated artifact after rendering",
          },
        ];
  return [
    ...acceptance,
    { name: "Regenerate", value: "regenerate" as const },
    { name: "Change recipe setup", value: "change-setup" as const },
    { name: "Change artifact", value: "change-artifact" as const },
    { name: "Cancel", value: "cancel" as const },
  ];
}

export async function promptMarkdownPdfCodexReviewAction(
  entry: MarkdownPdfInteractiveEntry,
  candidate: PreparedMarkdownPdfCodexCandidate,
): Promise<MarkdownPdfCodexReviewAction> {
  return await select<MarkdownPdfCodexReviewAction>({
    message: "Recipe review next step",
    choices: markdownPdfCodexReviewChoices(entry, candidate),
  });
}

export async function promptMarkdownPdfCodexReportRetention(
  lifecycle: "temporary-render" | "save-and-render" | "save-only",
  pathPromptContext: InteractivePathPromptContext,
): Promise<MarkdownPdfCodexReportRetention> {
  const choice = await select<"none" | "with-artifact" | "external">({
    message: "Keep a Codex diagnostic report?",
    choices: [
      { name: "No", value: "none" },
      ...(lifecycle === "temporary-render"
        ? []
        : [
            {
              name: "Keep with saved recipe",
              value: "with-artifact" as const,
              description: "Use the direct helper's report placement",
            },
          ]),
      {
        name: "Write to a separate path",
        value: "external",
        description: "Keep the report outside the recipe lifecycle",
      },
    ],
  });
  if (choice === "none" || choice === "with-artifact") {
    return { kind: choice };
  }
  return {
    kind: "external",
    path: await promptRequiredPathWithConfig("Codex report output file", {
      kind: "file",
      ...pathPromptContext,
    }),
  };
}
