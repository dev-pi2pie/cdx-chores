import { checkbox, confirm, input, select } from "@inquirer/prompts";

import { promptTextWithGhost } from "../../../prompts/text-inline";
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
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  markdownPdfPageNumberFormatTokens,
  type MarkdownPdfCodeTheme,
  type MarkdownPdfPageChromePosition,
} from "../../../markdown-pdf/profile";
import type { InteractivePathPromptContext } from "../../shared";
import type {
  MarkdownPdfFormalGuideMarginAnswers,
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

type MarkdownPdfFormalGuidePageNumberLabelChoice = "page" | "compact" | "custom";

const PAGE_NUMBER_LABEL_CHOICES: ReadonlyArray<{
  name: string;
  value: MarkdownPdfFormalGuidePageNumberLabelChoice;
  description: string;
}> = [
  { name: "Page 1", value: "page", description: "Recommended" },
  { name: "1", value: "compact", description: "Compact" },
  { name: "Custom...", value: "custom", description: "Use page-label placeholders" },
];

const REPEATING_CONTENT_GHOSTS: Readonly<Record<MarkdownPdfPageChromePosition, string>> = {
  "top-left": "{title}",
  "top-center": "{company}",
  "top-right": "{date}",
  "bottom-left": "{author}",
  "bottom-center": "{title}",
  "bottom-right": "{date}",
};

function pageNumberLabelChoiceFrom(
  format: string | undefined,
): MarkdownPdfFormalGuidePageNumberLabelChoice {
  if (format === undefined || format === "Page {page}") {
    return "page";
  }
  return format === "{page}" ? "compact" : "custom";
}

function repeatingContentPositionLabel(position: MarkdownPdfPageChromePosition): string {
  const [area, slot] = position.split("-");
  return `${area === "top" ? "Header" : "Footer"} ${slot}`;
}

function validatePageNumberLabel(value: string): true | string {
  if (!value.trim()) {
    return "Page-number label is required";
  }
  const tokens = markdownPdfPageNumberFormatTokens(value);
  return tokens.includes("page") || tokens.includes("pdfPage")
    ? true
    : "Page-number label must include the {page} or {pdfPage} placeholder";
}

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

export function createMarkdownPdfFormalGuidePrompts(
  pathPromptContext?: InteractivePathPromptContext,
): MarkdownPdfFormalGuidePrompts {
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

    async pageNumberLabel({ current }) {
      const choice = await select<MarkdownPdfFormalGuidePageNumberLabelChoice>({
        message: "Page-number label",
        choices: PAGE_NUMBER_LABEL_CHOICES,
        default: pageNumberLabelChoiceFrom(current),
      });
      if (choice === "page") {
        return "Page {page}";
      }
      if (choice === "compact") {
        return "{page}";
      }
      return await promptTextWithGhost({
        message: "Custom page-number label",
        helpLines: [
          "{page}: current logical page number",
          "{pages}: final logical page number in the selected countFrom domain",
          "{pdfPage}: current physical PDF page",
          "{pdfPages}: total physical PDF pages",
          "Literal text, punctuation, and digits are allowed; a literal total can become stale.",
        ],
        ghostHintLabel: "Page-number label suggestion (Right arrow to accept)",
        ghostText: "Page {page} of {pages}",
        ...(current !== undefined && pageNumberLabelChoiceFrom(current) === "custom"
          ? { initialValue: current }
          : {}),
        completionKind: "markdown-pdf-page-label",
        runtimeConfig: pathPromptContext?.runtimeConfig,
        stdin: pathPromptContext?.stdin,
        stdout: pathPromptContext?.stdout,
        validate: validatePageNumberLabel,
      });
    },

    async pageNumberPosition({ current }) {
      return await select<MarkdownPdfPageChromePosition>({
        message: "Page-number position",
        choices: PAGE_NUMBER_POSITION_CHOICES,
        default: current ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.position,
      });
    },

    async repeatingContentEnabled({ current }) {
      return await confirm({
        message: "Add repeating header or footer text?",
        default: current ?? false,
      });
    },

    async repeatingContentPositions({ available, current, reserved }) {
      const availablePositions = new Set(available);
      return await checkbox<MarkdownPdfPageChromePosition>({
        message: reserved
          ? `Repeating-content positions (page number uses ${repeatingContentPositionLabel(reserved).toLowerCase()})`
          : "Repeating-content positions",
        choices: MARKDOWN_PDF_PAGE_CHROME_POSITIONS.filter(
          (position) => availablePositions.has(position) || position === reserved,
        ).map((position) =>
          position === reserved
            ? {
                name: `${repeatingContentPositionLabel(position)} - Page number`,
                value: position,
                disabled: "Page-number position",
              }
            : {
                name: repeatingContentPositionLabel(position),
                value: position,
                checked: current?.includes(position) ?? false,
              },
        ),
      });
    },

    async repeatingContent({ current, position }) {
      return await promptTextWithGhost({
        message: `${repeatingContentPositionLabel(position)} content`,
        helpLines: [
          "Placeholders: {title}, {company}, {author}, {date}",
          "Values resolve from CLI metadata, Markdown frontmatter, then Profile metadata.",
          "Unknown or missing placeholders render as empty text; literal text is also valid.",
        ],
        ghostHintLabel: "Content suggestion (Right arrow to accept)",
        ghostText: REPEATING_CONTENT_GHOSTS[position],
        ...(current !== undefined ? { initialValue: current } : {}),
        completionKind: "markdown-pdf-repeating-content",
        runtimeConfig: pathPromptContext?.runtimeConfig,
        stdin: pathPromptContext?.stdin,
        stdout: pathPromptContext?.stdout,
        validate: (value) => (value.trim() ? true : "Repeating content is required"),
      });
    },

    async clearOccupiedPageNumberPosition({ position }) {
      return await confirm({
        message: `Clear existing ${repeatingContentPositionLabel(position).toLowerCase()} content that conflicts with page numbering?`,
        default: false,
      });
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
