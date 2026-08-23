import { join } from "node:path";

import {
  normalizeMarkdownPdfOptions,
  type MarkdownPdfOrientation,
  type MarkdownPdfPageSize,
  type MarkdownPdfPreset,
  type MarkdownPdfTocPageBreak,
} from "../../../src/cli/markdown-pdf/validation";
import { buildMarkdownPdfTableLayoutSignal } from "../../../src/cli/markdown-pdf/profile/layout-policy";
import type {
  MarkdownPdfTemplateCodexFitPressure,
  MarkdownPdfTemplateCodexOrientationBucket,
  MarkdownPdfTemplateCodexOutputPlan,
  MdPdfTemplateCodexSignalCollection,
} from "../../../src/cli/markdown-pdf/template-codex";

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
  fontHints?: string[];
  pdfContentLangs?: string[];
  profileFonts?: MdPdfTemplateCodexSignalCollection["fonts"]["profileFonts"];
  tableSignals?: Partial<MdPdfTemplateCodexSignalCollection["documentSignals"]["tables"]>;
  titleSignals?: Partial<MdPdfTemplateCodexSignalCollection["documentSignals"]["title"]>;
  titlePolicySignals?: Partial<MdPdfTemplateCodexSignalCollection["title"]>;
}

const PAGE_LAYOUT_RECIPE_FIELDS = new Set([
  "preset",
  "pageSize",
  "orientation",
  "margin",
  "marginX",
  "marginY",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
]);

export function createSynthesisSignals(
  input: CreateSynthesisSignalsInput = {},
): MdPdfTemplateCodexSignalCollection {
  const coverImage = input.coverImage;
  const explicitFields = input.explicitFields ?? [];
  const tables = {
    scannedRows: 0,
    maxColumns: 0,
    maxLineWidth: 0,
    overflowRows: 0,
    ...input.tableSignals,
  };
  const tableLayoutSignal = buildMarkdownPdfTableLayoutSignal(tables);
  const owner = explicitFields.some((field) => PAGE_LAYOUT_RECIPE_FIELDS.has(field))
    ? "explicit-recipe"
    : input.baseProfilePreset
      ? "base-profile"
      : undefined;
  const documentDerivedWideTable = tableLayoutSignal.level === "strong" && !owner && !input.preset;
  const preset =
    input.preset ??
    input.baseProfilePreset ??
    (documentDerivedWideTable ? "wide-table" : "article");
  const layoutPolicy: MdPdfTemplateCodexSignalCollection["recipe"]["layoutPolicy"] = {
    tableLayoutSignal,
    recipePreset:
      tableLayoutSignal.level !== "strong"
        ? {
            status: "not-needed",
            source: "document-table-signal",
            reason:
              tableLayoutSignal.level === "weak"
                ? "weak table layout signal affects table styling only"
                : "no table layout signal",
          }
        : owner
          ? {
              status: "blocked",
              source: "document-table-signal",
              preset: "wide-table",
              blockedBy: owner,
              reason: `strong table layout signal blocked by ${owner} page recipe ownership`,
            }
          : {
              status: "applied",
              source: "document-table-signal",
              preset: "wide-table",
              reason: "strong table layout signal derived wide-table recipe",
            },
  };

  return {
    signalMode: input.signalMode ?? (coverImage ? "deterministic" : "codex-assisted"),
    documentSignals: {
      available: true,
      headings: { total: 0, maxDepth: 0, byDepth: {} },
      tables,
      codeFences: { languages: [], unlabeledCount: 0, overflowLanguageCount: 0 },
      assets: { localCount: 0, remoteCount: 0, dataUriCount: 0 },
      frontmatter: { pdfContentLangs: input.pdfContentLangs ?? [], metadataKeys: [] },
      title: {
        frontmatterTitle: { present: false, charCount: 0 },
        firstH1: { present: false, charCount: 0 },
        normalizedTitleMatch: false,
        duplicateVisibleTitleRisk: false,
        ...input.titleSignals,
      },
      scripts: { scannedChars: 0, truncated: false, buckets: {} },
    },
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
      explicitFields,
      baseProfileFields: input.baseProfilePreset ? ["preset"] : [],
      layoutPolicy,
    },
    title: {
      explicitKeepMetadataTitleIntent: false,
      explicitHideMetadataTitleIntent: false,
      ...input.titlePolicySignals,
    },
    fonts: {
      hints: input.fontHints ?? [],
      profileFonts:
        input.profileFonts ??
        ({
          families: [],
          overflowFamilyCount: 0,
        } satisfies MdPdfTemplateCodexSignalCollection["fonts"]["profileFonts"]),
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
