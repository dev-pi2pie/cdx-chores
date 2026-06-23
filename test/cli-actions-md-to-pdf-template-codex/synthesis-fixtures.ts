import { join } from "node:path";

import {
  normalizeMarkdownPdfOptions,
  type MarkdownPdfOrientation,
  type MarkdownPdfPageSize,
  type MarkdownPdfPreset,
  type MarkdownPdfTocPageBreak,
} from "../../src/cli/markdown-pdf/validation";
import type {
  MarkdownPdfTemplateCodexFitPressure,
  MarkdownPdfTemplateCodexOrientationBucket,
  MarkdownPdfTemplateCodexOutputPlan,
  MdPdfTemplateCodexSignalCollection,
} from "../../src/cli/markdown-pdf/template-codex";

interface CreateSynthesisSignalsInput {
  preset?: MarkdownPdfPreset;
  pageSize?: MarkdownPdfPageSize;
  orientation?: MarkdownPdfOrientation;
  explicitFields?: string[];
  baseProfilePreset?: MarkdownPdfPreset;
  coverImage?: {
    orientationBucket?: MarkdownPdfTemplateCodexOrientationBucket;
    fitPressure?: MarkdownPdfTemplateCodexFitPressure;
    width?: number;
    height?: number;
  };
  signalMode?: MdPdfTemplateCodexSignalCollection["signalMode"];
  toc?: boolean;
  tocPageBreak?: MarkdownPdfTocPageBreak;
}

export function createSynthesisSignals(
  input: CreateSynthesisSignalsInput = {},
): MdPdfTemplateCodexSignalCollection {
  const preset = input.preset ?? input.baseProfilePreset ?? "article";
  const coverImage = input.coverImage;

  return {
    signalMode: input.signalMode ?? (coverImage ? "deterministic" : "codex-assisted"),
    documentSignals: {} as MdPdfTemplateCodexSignalCollection["documentSignals"],
    baseProfile: {
      available: Boolean(input.baseProfilePreset),
      ...(input.baseProfilePreset
        ? {
            summary: {
              id: "base-profile",
              kind: "base-profile",
              label: "User supplied base profile",
              presetBacked: true,
              preset: input.baseProfilePreset,
              basedOn: input.baseProfilePreset,
              fields: ["profile"],
              traits: {
                cover: false,
                toc: false,
                pageNumbers: false,
                codeHighlight: true,
                lineNumbers: false,
                density: "standard",
                bestFor: ["test fixture"],
              },
            },
          }
        : {}),
    },
    recipe: {
      effectiveOptions: normalizeMarkdownPdfOptions({
        preset,
        pageSize: input.pageSize,
        orientation: input.orientation,
        toc: input.toc,
        tocPageBreak: input.tocPageBreak,
      }),
      explicitFields: input.explicitFields ?? [],
      baseProfileFields: input.baseProfilePreset ? ["preset"] : [],
    },
    fonts: {
      hints: [],
      profileFonts: {} as MdPdfTemplateCodexSignalCollection["fonts"]["profileFonts"],
    },
    coverImage: coverImage
      ? {
          available: true,
          sourceBasename: "cover.png",
          format: "png",
          metadataStatus: "parsed",
          dimensions: {
            width: coverImage.width ?? 1200,
            height: coverImage.height ?? 800,
          },
          aspectRatio: Number(((coverImage.width ?? 1200) / (coverImage.height ?? 800)).toFixed(4)),
          orientationBucket: coverImage.orientationBucket ?? "landscape",
          fitPressure: coverImage.fitPressure ?? "normal",
        }
      : {
          available: false,
          orientationBucket: "unknown",
          fitPressure: "unknown",
        },
  };
}

export function createSynthesisOutputPlan(
  input: {
    includeCoverAsset?: boolean;
  } = {},
): MarkdownPdfTemplateCodexOutputPlan {
  const outputDirectory = "md-pdf-template-test";
  return {
    bundleId: "md-pdf-template-20260623T000000Z-test",
    outputDirectory,
    generatedOutputDirectory: true,
    templateHtml: {
      path: join(outputDirectory, "template.html"),
      bundlePath: "template.html",
    },
    styleCss: {
      path: join(outputDirectory, "style.css"),
      bundlePath: "style.css",
    },
    assets: input.includeCoverAsset
      ? [
          {
            path: join(outputDirectory, "assets", "cover.png"),
            bundlePath: "assets/cover.png",
            role: "cover-image",
            sourcePath: "source-cover.png",
            sourceBasename: "cover.png",
          },
        ]
      : [],
  };
}
