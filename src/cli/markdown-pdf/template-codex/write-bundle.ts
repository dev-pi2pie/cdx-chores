import { mkdir } from "node:fs/promises";

import { writeTextFileSafe } from "../../file-io";
import { copyMdPdfTemplateCodexManagedAssets } from "./asset-copy";
import { validateMdPdfTemplateCodexSynthesis } from "./validate-template";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexSynthesisResult,
} from "./types";

interface MdPdfTemplateCodexReportArtifact {
  artifactType: "markdown-pdf-template-codex-report";
  version: 1;
  advisoryOnly: true;
  bundle: {
    id: string;
    generatedOutputDirectory: boolean;
  };
  decision: {
    mode: MarkdownPdfTemplateCodexSynthesisResult["decisionMode"];
    templateFamily?: MarkdownPdfTemplateCodexSynthesisResult["templateFamily"];
    recipePreset?: string;
    recipePresetSource?: string;
  };
  files: Array<{
    role: "template-html" | "style-css" | "managed-asset";
    bundlePath: string;
    sourceLabel?: string;
  }>;
}

function createReportArtifact(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): MdPdfTemplateCodexReportArtifact {
  return {
    artifactType: "markdown-pdf-template-codex-report",
    version: 1,
    advisoryOnly: true,
    bundle: {
      id: input.outputPlan.bundleId,
      generatedOutputDirectory: input.outputPlan.generatedOutputDirectory,
    },
    decision: {
      mode: input.synthesis.decisionMode,
      ...(input.synthesis.decisionMode !== "no-usable-template"
        ? {
            templateFamily: input.synthesis.templateFamily,
            recipePreset: input.synthesis.slots.recipePreset.preset,
            recipePresetSource: input.synthesis.slots.recipePreset.source,
          }
        : {}),
    },
    files:
      input.synthesis.decisionMode === "no-usable-template"
        ? []
        : [
            {
              role: "template-html",
              bundlePath: input.outputPlan.templateHtml.bundlePath,
            },
            {
              role: "style-css",
              bundlePath: input.outputPlan.styleCss.bundlePath,
            },
            ...input.outputPlan.assets.map((asset) => ({
              role: "managed-asset" as const,
              bundlePath: asset.bundlePath,
              sourceLabel: asset.sourceBasename,
            })),
          ],
  };
}

async function writeReportIfRequested(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): Promise<void> {
  if (!input.outputPlan.report) {
    return;
  }
  await writeTextFileSafe(
    input.outputPlan.report.path,
    `${JSON.stringify(createReportArtifact(input), null, 2)}\n`,
    { overwrite: input.overwrite },
  );
}

export async function writeMdPdfTemplateCodexBundle(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): Promise<void> {
  validateMdPdfTemplateCodexSynthesis({
    outputPlan: input.outputPlan,
    synthesis: input.synthesis,
  });

  if (input.synthesis.decisionMode === "no-usable-template") {
    await writeReportIfRequested(input);
    return;
  }

  await mkdir(input.outputPlan.outputDirectory, { recursive: true });
  await writeTextFileSafe(input.outputPlan.templateHtml.path, input.synthesis.templateHtml, {
    overwrite: input.overwrite,
  });
  await writeTextFileSafe(input.outputPlan.styleCss.path, input.synthesis.styleCss, {
    overwrite: input.overwrite,
  });
  await copyMdPdfTemplateCodexManagedAssets({
    outputPlan: input.outputPlan,
    overwrite: input.overwrite,
  });
  await writeReportIfRequested(input);
}
