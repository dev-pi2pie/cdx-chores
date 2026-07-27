import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { normalizeMarkdownPdfProfile, validateMarkdownPdfProfileShape } from "../profile";
import {
  deriveMdPdfTemplateCodexFontOwnership,
  mdPdfTemplateCodexOwnsFontSlot,
  validateMdPdfTemplateCodexSynthesis,
} from "../template-codex";
import { assertProjectCodexBundlePathInsideOutput } from "./path-collisions";
import { createMdPdfProjectCodexRenderCommand } from "./render-command";
import type { MarkdownPdfProjectCodexRenderCommand } from "./render-command";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type { MdPdfProjectCodexTemplatePhaseResult } from "./template-phase";
import type {
  MarkdownPdfProjectCodexDecisionMode,
  MarkdownPdfProjectCodexOutputPlan,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";

export type MarkdownPdfProjectCodexValidationStatus = "passed" | "failed" | "skipped";

export interface MarkdownPdfProjectCodexValidationResult {
  name: string;
  status: MarkdownPdfProjectCodexValidationStatus;
  message?: string;
}

export interface MarkdownPdfProjectCodexValidationSummary {
  decisionMode: MarkdownPdfProjectCodexDecisionMode;
  results: MarkdownPdfProjectCodexValidationResult[];
  renderCommand?: MarkdownPdfProjectCodexRenderCommand;
  fallbackReason?: string;
}

type NormalizedProjectProfile = ReturnType<typeof normalizeMarkdownPdfProfile>;

interface MarkdownPdfProjectCodexValidationInput {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}

interface CollectedProjectValidation {
  normalizedProfile?: NormalizedProjectProfile;
  results: MarkdownPdfProjectCodexValidationResult[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failedValidation(name: string, error: unknown): MarkdownPdfProjectCodexValidationResult {
  return {
    name,
    status: "failed",
    message: errorMessage(error),
  };
}

function passedValidation(name: string): MarkdownPdfProjectCodexValidationResult {
  return { name, status: "passed" };
}

function skippedValidation(name: string, message: string): MarkdownPdfProjectCodexValidationResult {
  return { name, status: "skipped", message };
}

function assertArtifactBoundaries(outputPlan: MarkdownPdfProjectCodexOutputPlan): void {
  assertProjectCodexBundlePathInsideOutput({
    bundlePath: outputPlan.profile.bundlePath,
    outputDirectory: outputPlan.outputDirectory,
    path: outputPlan.profile.path,
    pathLabel: "profile.yml",
  });
  assertProjectCodexBundlePathInsideOutput({
    bundlePath: outputPlan.templateHtml.bundlePath,
    outputDirectory: outputPlan.outputDirectory,
    path: outputPlan.templateHtml.path,
    pathLabel: "template.html",
  });
  assertProjectCodexBundlePathInsideOutput({
    bundlePath: outputPlan.styleCss.bundlePath,
    outputDirectory: outputPlan.outputDirectory,
    path: outputPlan.styleCss.path,
    pathLabel: "style.css",
  });
  for (const asset of outputPlan.assets) {
    assertProjectCodexBundlePathInsideOutput({
      bundlePath: asset.bundlePath,
      outputDirectory: outputPlan.outputDirectory,
      path: asset.path,
      pathLabel: `managed asset ${asset.bundlePath}`,
    });
  }
  if (outputPlan.report?.location === "in-bundle") {
    assertProjectCodexBundlePathInsideOutput({
      bundlePath: outputPlan.report.bundlePath,
      outputDirectory: outputPlan.outputDirectory,
      path: outputPlan.report.path,
      pathLabel: "project Codex report",
    });
  }
}

function assertManagedAssetBindings(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}): void {
  const plannedAssets = new Set(input.outputPlan.assets.map((asset) => asset.bundlePath));
  const unplannedAsset = input.templatePhase.synthesis.managedAssets.find(
    (asset) => !plannedAssets.has(asset.bundlePath),
  );
  if (unplannedAsset) {
    throw new CliError(
      `Project template references an unplanned managed asset: ${unplannedAsset.bundlePath}`,
      {
        code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
        exitCode: 2,
      },
    );
  }
}

function assertProjectCompatibility(input: {
  normalizedProfile: NormalizedProjectProfile;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}): void {
  const { profile } = input.normalizedProfile;

  if (profile.cover.enabled && !input.templatePhase.synthesis.slots.cover.enabled) {
    throw new CliError(
      "Project template would defeat the profile-owned text cover; disable the profile cover or provide a compatible cover template.",
      {
        code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
        exitCode: 2,
      },
    );
  }

  if (
    profile.titleBlock.metadataTitle === "show" &&
    !input.templatePhase.synthesis.titlePolicy.visibleMetadataTitle
  ) {
    throw new CliError("Project template must preserve profile-owned metadata title output.", {
      code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
      exitCode: 2,
    });
  }

  if (
    profile.titleBlock.metadataTitle === "hide" &&
    input.templatePhase.synthesis.titlePolicy.visibleMetadataTitle
  ) {
    throw new CliError("Project template must preserve profile-owned metadata title suppression.", {
      code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
      exitCode: 2,
    });
  }

  const fontOwnership = deriveMdPdfTemplateCodexFontOwnership(profile);
  const overriddenProfileFonts = input.templatePhase.synthesis.fontDecisions.filter(
    (decision) =>
      mdPdfTemplateCodexOwnsFontSlot(fontOwnership, decision.role, decision.key) &&
      (decision.templateLevel || decision.status !== "blocked"),
  );
  if (overriddenProfileFonts.length > 0) {
    throw new CliError("Project stylesheet must not override profile-owned font decisions.", {
      code: "MARKDOWN_PDF_PROJECT_VALIDATION_FAILED",
      exitCode: 2,
    });
  }
}

const PROJECT_DECISION_MODE_PRIORITY = {
  deterministic: 0,
  "conservative-fallback": 1,
  adapted: 2,
  "no-usable-project": 3,
} satisfies Record<MarkdownPdfProjectCodexDecisionMode, number>;

function resolvePhaseDecisionMode(
  profilePhase: MdPdfProjectCodexProfilePhaseResult,
  templatePhase: MdPdfProjectCodexTemplatePhaseResult,
): MarkdownPdfProjectCodexDecisionMode {
  const modes = [profilePhase.phase.decisionMode, templatePhase.phase.decisionMode];
  return modes.reduce((selected, mode) =>
    PROJECT_DECISION_MODE_PRIORITY[mode] > PROJECT_DECISION_MODE_PRIORITY[selected]
      ? mode
      : selected,
  );
}

function firstFailedResult(
  results: readonly MarkdownPdfProjectCodexValidationResult[],
): MarkdownPdfProjectCodexValidationResult | undefined {
  return results.find((result) => result.status === "failed");
}

function resolveFallbackReason(input: {
  failedResult?: MarkdownPdfProjectCodexValidationResult;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}): string | undefined {
  return (
    input.failedResult?.message ??
    input.templatePhase.phase.fallbackReason ??
    input.profilePhase.phase.fallbackReason
  );
}

function collectProjectValidationResults(
  input: MarkdownPdfProjectCodexValidationInput,
): CollectedProjectValidation {
  const results: MarkdownPdfProjectCodexValidationResult[] = [];
  let normalizedProfile: NormalizedProjectProfile | undefined;

  try {
    validateMarkdownPdfProfileShape(input.profilePhase.finalProfile);
    results.push(passedValidation("profile-shape"));
  } catch (error) {
    results.push(failedValidation("profile-shape", error));
  }

  try {
    normalizedProfile = normalizeMarkdownPdfProfile({
      profile: input.profilePhase.finalProfile,
    });
    results.push(passedValidation("profile-normalization"));
  } catch (error) {
    results.push(failedValidation("profile-normalization", error));
  }

  try {
    validateMdPdfTemplateCodexSynthesis({
      outputPlan: input.templatePhase.outputPlan,
      synthesis: input.templatePhase.synthesis,
    });
    results.push(
      input.templatePhase.phase.decisionMode === "no-usable-project"
        ? skippedValidation(
            "template-static-validation",
            "Template phase returned no usable project.",
          )
        : passedValidation("template-static-validation"),
    );
  } catch (error) {
    results.push(failedValidation("template-static-validation", error));
  }

  try {
    assertArtifactBoundaries(input.outputPlan);
    results.push(passedValidation("artifact-boundaries"));
  } catch (error) {
    results.push(failedValidation("artifact-boundaries", error));
  }

  if (input.templatePhase.phase.decisionMode !== "no-usable-project") {
    try {
      assertManagedAssetBindings({
        outputPlan: input.outputPlan,
        templatePhase: input.templatePhase,
      });
      results.push(passedValidation("managed-asset-bindings"));
    } catch (error) {
      results.push(failedValidation("managed-asset-bindings", error));
    }
  } else {
    results.push(
      skippedValidation(
        "managed-asset-bindings",
        "Skipped because the template phase produced no managed assets.",
      ),
    );
  }

  if (normalizedProfile && input.templatePhase.phase.decisionMode !== "no-usable-project") {
    try {
      assertProjectCompatibility({
        normalizedProfile,
        templatePhase: input.templatePhase,
      });
      results.push(passedValidation("profile-template-compatibility"));
    } catch (error) {
      results.push(failedValidation("profile-template-compatibility", error));
    }
  } else {
    results.push(
      skippedValidation(
        "profile-template-compatibility",
        "Skipped because an earlier validation step produced no usable project.",
      ),
    );
  }

  return { normalizedProfile, results };
}

function resolveProjectValidationSummary(
  input: MarkdownPdfProjectCodexValidationInput & CollectedProjectValidation,
): MarkdownPdfProjectCodexValidationSummary {
  const failedResult = firstFailedResult(input.results);
  const decisionMode = failedResult
    ? "no-usable-project"
    : resolvePhaseDecisionMode(input.profilePhase, input.templatePhase);
  const renderCommand =
    decisionMode === "no-usable-project"
      ? undefined
      : createMdPdfProjectCodexRenderCommand({
          outputPlan: input.outputPlan,
          runtime: input.runtime,
          state: input.state,
        });

  const results = [...input.results];
  results.push(
    renderCommand
      ? passedValidation("render-command")
      : skippedValidation(
          "render-command",
          "Skipped because validation produced no usable project.",
        ),
  );

  const fallbackReason = resolveFallbackReason({
    failedResult,
    profilePhase: input.profilePhase,
    templatePhase: input.templatePhase,
  });

  return {
    decisionMode,
    results,
    renderCommand,
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

export function validateMdPdfProjectCodexProject(
  input: MarkdownPdfProjectCodexValidationInput,
): MarkdownPdfProjectCodexValidationSummary {
  return resolveProjectValidationSummary({
    ...input,
    ...collectProjectValidationResults(input),
  });
}
