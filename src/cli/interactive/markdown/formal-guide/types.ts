import type {
  MarkdownPdfOrientation,
  MarkdownPdfPageSize,
  MarkdownPdfPreset,
  MarkdownPdfTocPageBreak,
} from "../../../markdown-pdf/validation";
import type { MarkdownPdfCodeTheme } from "../../../markdown-pdf/profile";

export type MarkdownPdfFormalGuideGroup = "code" | "layout" | "margins" | "toc";

export type MarkdownPdfFormalGuideOrientationAnswer =
  | { mode: "preset-default" }
  | { mode: "override"; value: MarkdownPdfOrientation };

export interface MarkdownPdfFormalGuideLayoutAnswers {
  preset: MarkdownPdfPreset;
  pageSize: MarkdownPdfPageSize;
  orientation: MarkdownPdfFormalGuideOrientationAnswer;
}

export interface MarkdownPdfFormalGuideCustomMargins {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export type MarkdownPdfFormalGuideMarginAnswers =
  | { mode: "preset-default" }
  | { mode: "uniform"; value: string }
  | ({ mode: "custom" } & MarkdownPdfFormalGuideCustomMargins);

export interface MarkdownPdfFormalGuideTocDetails {
  depth: number;
  pageBreak: MarkdownPdfTocPageBreak;
}

export type MarkdownPdfFormalGuideTocAnswers =
  | { enabled: false }
  | ({ enabled: true } & MarkdownPdfFormalGuideTocDetails);

export interface MarkdownPdfFormalGuideCodeAnswers {
  highlight: boolean;
  theme: MarkdownPdfCodeTheme;
  lineNumbers: boolean;
  transformerNotation: boolean;
}

export interface MarkdownPdfFormalGuideAnswers {
  layout: MarkdownPdfFormalGuideLayoutAnswers;
  margins: MarkdownPdfFormalGuideMarginAnswers;
  toc: MarkdownPdfFormalGuideTocAnswers;
}

export interface MarkdownPdfProfileFormalGuideAnswers extends MarkdownPdfFormalGuideAnswers {
  code: MarkdownPdfFormalGuideCodeAnswers;
}

export interface MarkdownPdfFormalGuidePromptContext<TAnswers> {
  current?: Readonly<TAnswers>;
}

export interface MarkdownPdfFormalGuideMarginPromptContext extends MarkdownPdfFormalGuidePromptContext<MarkdownPdfFormalGuideMarginAnswers> {
  layout: Readonly<MarkdownPdfFormalGuideLayoutAnswers>;
}

export type MarkdownPdfFormalGuideTocDetailsPromptContext =
  MarkdownPdfFormalGuidePromptContext<MarkdownPdfFormalGuideTocDetails>;

export type MarkdownPdfFormalGuidePromptResult<T> = T | Promise<T>;

export interface MarkdownPdfFormalGuidePrompts {
  codeHighlight(
    context: MarkdownPdfFormalGuidePromptContext<boolean>,
  ): MarkdownPdfFormalGuidePromptResult<boolean>;
  codeTheme(
    context: MarkdownPdfFormalGuidePromptContext<MarkdownPdfCodeTheme>,
  ): MarkdownPdfFormalGuidePromptResult<MarkdownPdfCodeTheme>;
  codeLineNumbers(
    context: MarkdownPdfFormalGuidePromptContext<boolean>,
  ): MarkdownPdfFormalGuidePromptResult<boolean>;
  codeTransformerNotation(
    context: MarkdownPdfFormalGuidePromptContext<boolean>,
  ): MarkdownPdfFormalGuidePromptResult<boolean>;
  layout(
    context: MarkdownPdfFormalGuidePromptContext<MarkdownPdfFormalGuideLayoutAnswers>,
  ): MarkdownPdfFormalGuidePromptResult<MarkdownPdfFormalGuideLayoutAnswers>;
  margins(
    context: MarkdownPdfFormalGuideMarginPromptContext,
  ): MarkdownPdfFormalGuidePromptResult<MarkdownPdfFormalGuideMarginAnswers>;
  tocEnabled(
    context: MarkdownPdfFormalGuidePromptContext<boolean>,
  ): MarkdownPdfFormalGuidePromptResult<boolean>;
  tocDetails(
    context: MarkdownPdfFormalGuideTocDetailsPromptContext,
  ): MarkdownPdfFormalGuidePromptResult<MarkdownPdfFormalGuideTocDetails>;
}
