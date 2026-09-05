import { basename, join } from "node:path";
import {
  synthesizeMdPdfTemplateCodex,
  type MdPdfTemplateCodexSignalCollection,
  type MarkdownPdfTemplateCodexOutputPlan,
  type MarkdownPdfTemplateCodexSynthesisResult,
  type NormalizedMdPdfTemplateCodexCommandState,
} from "../../../../src/cli/markdown-pdf/template-codex";
import { createCapturedRuntime } from "../../../helpers/cli-test-utils";
import { createSynthesisSignals } from "./template-synthesis-fixtures";

export function outputPlan(input: {
  coverImagePath?: string;
  outputDirectory: string;
  reportPath?: string;
}): MarkdownPdfTemplateCodexOutputPlan {
  return {
    bundleId: "md-pdf-template-20260623T000000Z-test",
    generatedOutputDirectory: true,
    outputDirectory: input.outputDirectory,
    templateHtml: {
      path: join(input.outputDirectory, "template.html"),
      bundlePath: "template.html",
    },
    styleCss: {
      path: join(input.outputDirectory, "style.css"),
      bundlePath: "style.css",
    },
    ...(input.reportPath
      ? {
          report: {
            path: input.reportPath,
            location: "external" as const,
          },
        }
      : {}),
    assets: input.coverImagePath
      ? [
          {
            role: "cover-image" as const,
            sourcePath: input.coverImagePath,
            sourceBasename: basename(input.coverImagePath),
            path: join(input.outputDirectory, "assets", "cover.png"),
            bundlePath: "assets/cover.png",
          },
        ]
      : [],
  };
}

export function synthesizeForPlan(
  plan: MarkdownPdfTemplateCodexOutputPlan,
): MarkdownPdfTemplateCodexSynthesisResult {
  return synthesizeMdPdfTemplateCodex({
    outputPlan: plan,
    signals: signalsForPlan(plan),
  });
}

export function signalsForPlan(
  plan: MarkdownPdfTemplateCodexOutputPlan,
): MdPdfTemplateCodexSignalCollection {
  return createSynthesisSignals({
    coverImage: plan.assets.length > 0 ? {} : undefined,
    signalMode: "deterministic",
  });
}

export function commandStateForSignals(
  signals: MdPdfTemplateCodexSignalCollection,
  input: { coverImagePath?: string } = {},
): NormalizedMdPdfTemplateCodexCommandState {
  return {
    fontHints: [],
    dryRun: false,
    keepCodexReport: false,
    overwrite: false,
    recipeOptions: signals.recipe.effectiveOptions,
    explicitRecipe: {
      fields: [],
      options: {},
    },
    ...(input.coverImagePath ? { coverImagePath: input.coverImagePath } : {}),
  };
}

export function bundleWriteContext(plan: MarkdownPdfTemplateCodexOutputPlan) {
  const signals = signalsForPlan(plan);
  const { runtime } = createCapturedRuntime();
  return {
    runtime,
    signals,
    state: commandStateForSignals(signals, {
      coverImagePath: plan.assets[0]?.sourcePath,
    }),
  };
}
