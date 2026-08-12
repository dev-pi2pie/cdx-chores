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
  MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES,
  MARKDOWN_PDF_PAGE_NUMBER_SCOPES,
  isMarkdownPdfPageChromeColor,
  isMarkdownPdfPageChromeFontSize,
  isMarkdownPdfPageChromeLineHeight,
  isMarkdownPdfPageChromeSeparatorGap,
  isMarkdownPdfPageChromeSeparatorWidth,
  type MarkdownPdfCodeTheme,
  type MarkdownPdfPageChromeFontWeight,
  type MarkdownPdfPageChromePosition,
  type MarkdownPdfPageChromeSeparatorStyle,
  type MarkdownPdfPageNumberCountOrigin,
  type MarkdownPdfPageNumberScope,
} from "../../../markdown-pdf/profile";
import type {
  MarkdownPdfFormalGuideMarginAnswers,
  MarkdownPdfFormalGuidePageChromeSeparatorAnswers,
  MarkdownPdfFormalGuidePageChromeStyleAnswers,
  MarkdownPdfFormalGuidePrompts,
} from "./types";

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

function validateInteger(value: string, label: string, minimum: number): true | string {
  if (value.trim() === "") {
    return `${label} must be an integer of at least ${minimum}.`;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum
    ? true
    : `${label} must be an integer of at least ${minimum}.`;
}

function validateBoundedValue(
  value: unknown,
  label: string,
  predicate: (candidate: unknown) => boolean,
): true | string {
  return predicate(value) ? true : `${label} is outside the supported Profile range.`;
}

async function promptPageChromeSeparator(
  areaLabel: string,
  current: Readonly<MarkdownPdfFormalGuidePageChromeSeparatorAnswers> | undefined,
): Promise<MarkdownPdfFormalGuidePageChromeSeparatorAnswers | undefined> {
  const enabled = await confirm({
    message: `Add a ${areaLabel.toLowerCase()} separator?`,
    default: current !== undefined,
  });
  if (!enabled) {
    return undefined;
  }

  const width = await input({
    message: `${areaLabel} separator width`,
    default: current?.width ?? "0.5pt",
    validate: (value) =>
      validateBoundedValue(
        value,
        `${areaLabel} separator width`,
        isMarkdownPdfPageChromeSeparatorWidth,
      ),
  });
  const style = await select<MarkdownPdfPageChromeSeparatorStyle>({
    message: `${areaLabel} separator style`,
    choices: MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES.map((value) => ({ name: value, value })),
    default: current?.style ?? MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES[0],
  });
  const color = await input({
    message: `${areaLabel} separator color`,
    default: current?.color ?? "#d0d5dd",
    validate: (value) =>
      validateBoundedValue(value, `${areaLabel} separator color`, isMarkdownPdfPageChromeColor),
  });
  const gapInput = await input({
    message: `${areaLabel} separator gap`,
    default: current?.gap === 0 ? "0" : (current?.gap ?? "2mm"),
    validate: (value) =>
      validateBoundedValue(
        value.trim() === "0" ? 0 : value,
        `${areaLabel} separator gap`,
        isMarkdownPdfPageChromeSeparatorGap,
      ),
  });

  return {
    width,
    style,
    color,
    gap: gapInput.trim() === "0" ? 0 : gapInput,
  };
}

async function promptPageChromeStyle(
  areaLabel: string,
  current: Readonly<MarkdownPdfFormalGuidePageChromeStyleAnswers> | undefined,
): Promise<MarkdownPdfFormalGuidePageChromeStyleAnswers | undefined> {
  const enabled = await confirm({
    message: `Configure ${areaLabel.toLowerCase()} style?`,
    default: current !== undefined,
  });
  if (!enabled) {
    return undefined;
  }

  const fontSize = await input({
    message: `${areaLabel} font size`,
    default: current?.fontSize ?? "8.5pt",
    validate: (value) =>
      validateBoundedValue(value, `${areaLabel} font size`, isMarkdownPdfPageChromeFontSize),
  });
  const fontWeight = await select<MarkdownPdfPageChromeFontWeight>({
    message: `${areaLabel} font weight`,
    choices: MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS.map((value) => ({
      name: String(value),
      value,
    })),
    default: current?.fontWeight ?? 400,
  });
  const lineHeightInput = await input({
    message: `${areaLabel} line height`,
    default: String(current?.lineHeight ?? 1.2),
    validate: (value) =>
      validateBoundedValue(
        Number(value),
        `${areaLabel} line height`,
        isMarkdownPdfPageChromeLineHeight,
      ),
  });
  const color = await input({
    message: `${areaLabel} color`,
    default: current?.color ?? "#667085",
    validate: (value) =>
      validateBoundedValue(value, `${areaLabel} color`, isMarkdownPdfPageChromeColor),
  });
  const separator = await promptPageChromeSeparator(areaLabel, current?.separator);

  return {
    fontSize,
    fontWeight,
    lineHeight: Number(lineHeightInput),
    color,
    ...(separator ? { separator } : {}),
  };
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

    async pageNumberScope({ current }) {
      return await select<MarkdownPdfPageNumberScope>({
        message: "Show page numbers on",
        choices: MARKDOWN_PDF_PAGE_NUMBER_SCOPES.map((value) => ({ name: value, value })),
        default: current ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.scope,
      });
    },

    async pageNumberDetails({ countFromChoices, current }) {
      const retainedCountFrom = current?.countFrom;
      const countFrom = await select<MarkdownPdfPageNumberCountOrigin>({
        message: "Count page numbers from",
        choices: countFromChoices.map((value) => ({ name: value, value })),
        default:
          retainedCountFrom !== undefined && countFromChoices.includes(retainedCountFrom)
            ? retainedCountFrom
            : (countFromChoices[0] ??
              DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.countFrom),
      });
      const startInput = await input({
        message: "First page number",
        default: String(
          current?.start ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.start,
        ),
        validate: (value) => validateInteger(value, "First page number", 0),
      });
      const incrementInput = await input({
        message: "Page-number increment",
        default: String(
          current?.increment ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.increment,
        ),
        validate: (value) => validateInteger(value, "Page-number increment", 1),
      });
      const position = await select<MarkdownPdfPageChromePosition>({
        message: "Page-number position",
        choices: MARKDOWN_PDF_PAGE_CHROME_POSITIONS.map((value) => ({ name: value, value })),
        default: current?.position ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.position,
      });
      const format = await input({
        message: "Page-number label template",
        default: current?.format ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.format,
      });

      return {
        countFrom,
        start: Number(startInput),
        increment: Number(incrementInput),
        position,
        format,
      };
    },

    async pageChromeArea({ area, current }) {
      const areaLabel = area === "header" ? "Header" : "Footer";
      const left = await input({ message: `${areaLabel} left`, default: current?.left ?? "" });
      const center = await input({
        message: `${areaLabel} center`,
        default: current?.center ?? "",
      });
      const right = await input({ message: `${areaLabel} right`, default: current?.right ?? "" });
      const style = await promptPageChromeStyle(areaLabel, current?.style);
      return { left, center, right, ...(style ? { style } : {}) };
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
