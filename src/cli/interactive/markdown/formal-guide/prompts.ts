import { confirm, input, select } from "@inquirer/prompts";

import {
  MARKDOWN_PDF_ORIENTATIONS,
  MARKDOWN_PDF_PAGE_SIZES,
  MARKDOWN_PDF_PRESETS,
  MARKDOWN_PDF_PRESET_GUIDANCE,
  MARKDOWN_PDF_TOC_PAGE_BREAKS,
  validateMarkdownPdfCssLength,
  type MarkdownPdfOrientation,
  type MarkdownPdfTocPageBreak,
} from "../../../markdown-pdf/validation";
import type { MarkdownPdfFormalGuideMarginAnswers, MarkdownPdfFormalGuidePrompts } from "./types";

function validateMargin(value: string, label: string): true | string {
  try {
    validateMarkdownPdfCssLength(value, label);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function promptMargin(message: string, current = "18mm"): Promise<string> {
  return await input({
    message,
    default: current,
    validate: (value) => validateMargin(value, message),
  });
}

export function createMarkdownPdfFormalGuidePrompts(): MarkdownPdfFormalGuidePrompts {
  return {
    async layout({ current }) {
      const preset = await select({
        message: "Document preset",
        choices: MARKDOWN_PDF_PRESETS.map((value) => ({
          name: value,
          value,
          description: MARKDOWN_PDF_PRESET_GUIDANCE[value].bestFor.join(", "),
        })),
        default: current?.preset,
      });
      const pageSize = await select({
        message: "Page size",
        choices: MARKDOWN_PDF_PAGE_SIZES.map((value) => ({ name: value, value })),
        default: current?.pageSize,
      });
      const orientation = await select<"preset-default" | MarkdownPdfOrientation>({
        message: "Page orientation",
        choices: [
          {
            name: "Use preset default",
            value: "preset-default",
            description: "Keep orientation coupled to the selected preset",
          },
          ...MARKDOWN_PDF_ORIENTATIONS.map((value) => ({ name: value, value })),
        ],
        default:
          current?.orientation.mode === "override" ? current.orientation.value : "preset-default",
      });
      return {
        preset,
        pageSize,
        orientation:
          orientation === "preset-default"
            ? { mode: "preset-default" }
            : { mode: "override", value: orientation },
      };
    },

    async margins({ current }) {
      const mode = await select<MarkdownPdfFormalGuideMarginAnswers["mode"]>({
        message: "Page margins",
        choices: [
          {
            name: "Use preset defaults",
            value: "preset-default",
            description: "Keep margins coupled to the selected preset",
          },
          { name: "One margin for every side", value: "uniform" },
          { name: "Set each side", value: "custom" },
        ],
        default: current?.mode,
      });
      if (mode === "preset-default") {
        return { mode };
      }
      if (mode === "uniform") {
        return {
          mode,
          value: await promptMargin(
            "Uniform page margin",
            current?.mode === "uniform" ? current.value : undefined,
          ),
        };
      }
      const previous = current?.mode === "custom" ? current : undefined;
      return {
        mode,
        top: await promptMargin("Top margin", previous?.top),
        right: await promptMargin("Right margin", previous?.right),
        bottom: await promptMargin("Bottom margin", previous?.bottom),
        left: await promptMargin("Left margin", previous?.left),
      };
    },

    async tocEnabled({ current }) {
      return await confirm({ message: "Include a table of contents?", default: current ?? false });
    },

    async tocDetails({ current }) {
      const depth = await select<number>({
        message: "Table of contents depth",
        choices: [1, 2, 3, 4, 5, 6].map((value) => ({ name: String(value), value })),
        default: current?.depth ?? 3,
      });
      const pageBreak = await select<MarkdownPdfTocPageBreak>({
        message: "Table of contents page break",
        choices: MARKDOWN_PDF_TOC_PAGE_BREAKS.map((value) => ({ name: value, value })),
        default: current?.pageBreak ?? "auto",
      });
      return { depth, pageBreak };
    },
  };
}
