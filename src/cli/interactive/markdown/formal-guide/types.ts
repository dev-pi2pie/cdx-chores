import type {
  MarkdownPdfOrientation,
  MarkdownPdfPageSize,
  MarkdownPdfPreset,
  MarkdownPdfTocPageBreak,
} from "../../../markdown-pdf/validation";
import type {
  MarkdownPdfCodeTheme,
  MarkdownPdfPageChromeFontWeight,
  MarkdownPdfPageChromePosition,
  MarkdownPdfPageChromeSeparatorStyle,
  MarkdownPdfPageNumberCountOrigin,
  MarkdownPdfPageNumberScope,
} from "../../../markdown-pdf/profile";

export type MarkdownPdfFormalGuideSharedGroup = "layout" | "margins" | "toc";

export type MarkdownPdfProfileFormalGuideGroup =
  | MarkdownPdfFormalGuideSharedGroup
  | "code"
  | "page-chrome"
  | "page-numbers";

export type MarkdownPdfFormalGuideGroup = MarkdownPdfFormalGuideSharedGroup | "code";

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

export interface MarkdownPdfFormalGuidePageNumberDetails {
  position: MarkdownPdfPageChromePosition;
  format: string;
  countFrom: MarkdownPdfPageNumberCountOrigin;
  start: number;
  increment: number;
}

export interface MarkdownPdfFormalGuidePageNumberAnswers extends MarkdownPdfFormalGuidePageNumberDetails {
  enabled: boolean;
  scope: MarkdownPdfPageNumberScope;
}

export type MarkdownPdfFormalGuidePageNumberOutcome = "body" | "document";

export type MarkdownPdfFormalGuidePageChromeSlot = "left" | "center" | "right";

export interface MarkdownPdfFormalGuidePageChromeSeparatorAnswers {
  width?: string;
  style?: MarkdownPdfPageChromeSeparatorStyle;
  color?: string;
  gap?: string | 0;
}

export interface MarkdownPdfFormalGuidePageChromeStyleAnswers {
  fontSize?: string;
  fontWeight?: MarkdownPdfPageChromeFontWeight;
  lineHeight?: number;
  color?: string;
  separator?: MarkdownPdfFormalGuidePageChromeSeparatorAnswers;
}

export interface MarkdownPdfFormalGuidePageChromeAreaAnswers {
  left: string;
  center: string;
  right: string;
  style?: MarkdownPdfFormalGuidePageChromeStyleAnswers;
}

export interface MarkdownPdfFormalGuidePageChromeAnswers {
  header: MarkdownPdfFormalGuidePageChromeAreaAnswers;
  footer: MarkdownPdfFormalGuidePageChromeAreaAnswers;
}

export interface MarkdownPdfFormalGuideAnswers {
  layout: MarkdownPdfFormalGuideLayoutAnswers;
  margins: MarkdownPdfFormalGuideMarginAnswers;
  toc: MarkdownPdfFormalGuideTocAnswers;
}

export interface MarkdownPdfProfileFormalGuideAnswers extends MarkdownPdfFormalGuideAnswers {
  code: MarkdownPdfFormalGuideCodeAnswers;
  pageChrome: MarkdownPdfFormalGuidePageChromeAnswers;
  pageNumbers: MarkdownPdfFormalGuidePageNumberAnswers;
}

export interface MarkdownPdfFormalGuidePromptContext<TAnswers> {
  current?: Readonly<TAnswers>;
}

export interface MarkdownPdfFormalGuideMarginPromptContext extends MarkdownPdfFormalGuidePromptContext<MarkdownPdfFormalGuideMarginAnswers> {
  layout: Readonly<MarkdownPdfFormalGuideLayoutAnswers>;
}

export type MarkdownPdfFormalGuideTocDetailsPromptContext =
  MarkdownPdfFormalGuidePromptContext<MarkdownPdfFormalGuideTocDetails>;

export interface MarkdownPdfFormalGuideRepeatingContentPositionsPromptContext extends MarkdownPdfFormalGuidePromptContext<
  readonly MarkdownPdfPageChromePosition[]
> {
  available: readonly MarkdownPdfPageChromePosition[];
  reserved?: MarkdownPdfPageChromePosition;
}

export interface MarkdownPdfFormalGuideRepeatingContentPromptContext extends MarkdownPdfFormalGuidePromptContext<string> {
  position: MarkdownPdfPageChromePosition;
}

export interface MarkdownPdfFormalGuideOccupiedPositionPromptContext {
  current: string;
  position: MarkdownPdfPageChromePosition;
}

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
  pageNumbersEnabled(
    context: MarkdownPdfFormalGuidePromptContext<boolean>,
  ): MarkdownPdfFormalGuidePromptResult<boolean>;
  pageNumberOutcome(
    context: MarkdownPdfFormalGuidePromptContext<MarkdownPdfFormalGuidePageNumberOutcome>,
  ): MarkdownPdfFormalGuidePromptResult<MarkdownPdfFormalGuidePageNumberOutcome>;
  pageNumberLabel(
    context: MarkdownPdfFormalGuidePromptContext<string>,
  ): MarkdownPdfFormalGuidePromptResult<string>;
  pageNumberPosition(
    context: MarkdownPdfFormalGuidePromptContext<MarkdownPdfPageChromePosition>,
  ): MarkdownPdfFormalGuidePromptResult<MarkdownPdfPageChromePosition>;
  repeatingContentEnabled(
    context: MarkdownPdfFormalGuidePromptContext<boolean>,
  ): MarkdownPdfFormalGuidePromptResult<boolean>;
  repeatingContentPositions(
    context: MarkdownPdfFormalGuideRepeatingContentPositionsPromptContext,
  ): MarkdownPdfFormalGuidePromptResult<readonly MarkdownPdfPageChromePosition[]>;
  repeatingContent(
    context: MarkdownPdfFormalGuideRepeatingContentPromptContext,
  ): MarkdownPdfFormalGuidePromptResult<string>;
  clearOccupiedPageNumberPosition(
    context: MarkdownPdfFormalGuideOccupiedPositionPromptContext,
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
