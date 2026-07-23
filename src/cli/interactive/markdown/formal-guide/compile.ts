import {
  normalizeMarkdownPdfOptions,
  validateMarkdownPdfCssLength,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../../markdown-pdf/validation";
import type { NormalizedMarkdownPdfCode } from "../../../markdown-pdf/profile";
import type {
  MarkdownPdfFormalGuideAnswers,
  MarkdownPdfFormalGuideMarginAnswers,
  MarkdownPdfProfileFormalGuideAnswers,
} from "./types";

function compileMargins(
  margins: Readonly<MarkdownPdfFormalGuideMarginAnswers>,
): Pick<
  NormalizeMarkdownPdfOptionsInput,
  "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
> {
  if (margins.mode === "preset-default") {
    return {};
  }

  if (margins.mode === "uniform") {
    return {
      margin: validateMarkdownPdfCssLength(margins.value, "Margin"),
    };
  }

  return {
    marginTop: validateMarkdownPdfCssLength(margins.top, "Top margin"),
    marginRight: validateMarkdownPdfCssLength(margins.right, "Right margin"),
    marginBottom: validateMarkdownPdfCssLength(margins.bottom, "Bottom margin"),
    marginLeft: validateMarkdownPdfCssLength(margins.left, "Left margin"),
  };
}

export function compileMarkdownPdfFormalGuideOptions(
  answers: Readonly<MarkdownPdfFormalGuideAnswers>,
): NormalizeMarkdownPdfOptionsInput {
  const input: NormalizeMarkdownPdfOptionsInput = {
    preset: answers.layout.preset,
    pageSize: answers.layout.pageSize,
    ...compileMargins(answers.margins),
    toc: answers.toc.enabled,
  };

  if (answers.layout.orientation.mode === "override") {
    input.orientation = answers.layout.orientation.value;
  }

  if (answers.toc.enabled) {
    input.tocDepth = answers.toc.depth;
    input.tocPageBreak = answers.toc.pageBreak;
  }

  normalizeMarkdownPdfOptions(input);
  return input;
}

export function compileMarkdownPdfFormalGuideCode(
  answers: Readonly<MarkdownPdfProfileFormalGuideAnswers>,
): NormalizedMarkdownPdfCode {
  return {
    highlight: answers.code.highlight,
    theme: answers.code.theme,
    lineNumbers: answers.code.highlight ? answers.code.lineNumbers : false,
    transformerNotation: answers.code.highlight ? answers.code.transformerNotation : false,
  };
}
