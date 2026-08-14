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
import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_CODE_THEMES,
  type MarkdownPdfCodeTheme,
  type MarkdownPdfPageChromePosition,
} from "../../../markdown-pdf/profile";
import type {
  MarkdownPdfFormalGuideMarginAnswers,
  MarkdownPdfFormalGuidePageChromeSelection,
  MarkdownPdfFormalGuidePageNumberOutcome,
  MarkdownPdfFormalGuidePrompts,
} from "./types";

const PAGE_NUMBER_OUTCOME_CHOICES: ReadonlyArray<{
  name: string;
  value: MarkdownPdfFormalGuidePageNumberOutcome;
}> = [
  { name: "Body pages, starting at 1", value: "body" },
  { name: "Entire document, starting at 1", value: "document" },
];

const PAGE_NUMBER_POSITION_CHOICES: ReadonlyArray<{
  name: string;
  value: MarkdownPdfPageChromePosition;
}> = [
  { name: "Bottom center", value: "bottom-center" },
  { name: "Bottom right", value: "bottom-right" },
  { name: "Bottom left", value: "bottom-left" },
  { name: "Top center", value: "top-center" },
  { name: "Top right", value: "top-right" },
  { name: "Top left", value: "top-left" },
];

const PAGE_CHROME_SELECTION_CHOICES: ReadonlyArray<{
  name: string;
  value: MarkdownPdfFormalGuidePageChromeSelection;
}> = [
  { name: "No", value: "none" },
  { name: "Header", value: "header" },
  { name: "Footer", value: "footer" },
  { name: "Both", value: "both" },
];

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
    async codeHighlight({ current }) {
      return await confirm({
        message: "Enable code highlighting in this Profile?",
        default: current ?? true,
      });
    },

    async codeTheme({ current }) {
      return await select<MarkdownPdfCodeTheme>({
        message: "Theme",
        choices: MARKDOWN_PDF_CODE_THEMES.map((value) => ({
          name: value,
          value,
        })),
        default: current ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code.theme,
      });
    },

    async codeLineNumbers({ current }) {
      return await confirm({
        message: "Show line numbers in highlighted code blocks?",
        default: current ?? false,
      });
    },

    async codeTransformerNotation({ current }) {
      return await confirm({
        message: "Enable transformer notation in highlighted code blocks?",
        default: current ?? false,
      });
    },

    async pageNumbersEnabled({ current }) {
      return await confirm({
        message: "Enable reusable page numbers in this Profile?",
        default: current ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.enabled,
      });
    },

    async pageNumberOutcome({ current }) {
      return await select<MarkdownPdfFormalGuidePageNumberOutcome>({
        message: "Number which pages?",
        choices: PAGE_NUMBER_OUTCOME_CHOICES,
        default: current ?? "body",
      });
    },

    async pageNumberPosition({ current }) {
      return await select<MarkdownPdfPageChromePosition>({
        message: "Page-number position",
        choices: PAGE_NUMBER_POSITION_CHOICES,
        default: current ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.position,
      });
    },

    async pageChromeSelection({ current }) {
      return await select<MarkdownPdfFormalGuidePageChromeSelection>({
        message: "Add repeating header or footer text?",
        choices: PAGE_CHROME_SELECTION_CHOICES,
        default: current ?? "none",
      });
    },

    async pageChromeArea({ area, current, slots }) {
      const areaLabel = area === "header" ? "Header" : "Footer";
      const answers = {
        left: current?.left ?? "",
        center: current?.center ?? "",
        right: current?.right ?? "",
      };
      for (const slot of ["left", "center", "right"] as const) {
        if (!slots.includes(slot)) {
          continue;
        }
        answers[slot] = await input({
          message: `${areaLabel} ${slot}`,
          default: current?.[slot] ?? "",
        });
      }
      return {
        ...answers,
        ...(current?.style ? { style: current.style } : {}),
      };
    },

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
        choices: MARKDOWN_PDF_PAGE_SIZES.map((value) => ({
          name: value,
          value,
        })),
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
      return await confirm({
        message: "Include a table of contents?",
        default: current ?? false,
      });
    },

    async tocDetails({ current }) {
      const depth = await select<number>({
        message: "Table of contents depth",
        choices: [1, 2, 3, 4, 5, 6].map((value) => ({
          name: String(value),
          value,
        })),
        default: current?.depth ?? 3,
      });
      const pageBreak = await select<MarkdownPdfTocPageBreak>({
        message: "Table of contents page break",
        choices: MARKDOWN_PDF_TOC_PAGE_BREAKS.map((value) => ({
          name: value,
          value,
        })),
        default: current?.pageBreak ?? "auto",
      });
      return { depth, pageBreak };
    },
  };
}
