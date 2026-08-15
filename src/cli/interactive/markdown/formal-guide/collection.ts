import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  resolveMarkdownPdfPageNumberSlot,
  type MarkdownPdfPageChromePosition,
} from "../../../markdown-pdf/profile";
import {
  compileMarkdownPdfFormalGuidePageChrome,
  compileMarkdownPdfFormalGuidePageNumbers,
} from "./compile";
import type {
  MarkdownPdfFormalGuideAnswers,
  MarkdownPdfFormalGuideCodeAnswers,
  MarkdownPdfFormalGuideLayoutAnswers,
  MarkdownPdfFormalGuideMarginAnswers,
  MarkdownPdfFormalGuidePageChromeAnswers,
  MarkdownPdfFormalGuidePageChromeAreaAnswers,
  MarkdownPdfFormalGuidePageNumberAnswers,
  MarkdownPdfFormalGuidePrompts,
  MarkdownPdfProfileFormalGuideAnswers,
  MarkdownPdfFormalGuideTocAnswers,
  MarkdownPdfFormalGuideTocDetails,
} from "./types";

const DEFAULT_CODE_THEME = DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code.theme;

async function collectCode(
  prompts: MarkdownPdfFormalGuidePrompts,
  current?: Readonly<MarkdownPdfFormalGuideCodeAnswers>,
): Promise<MarkdownPdfFormalGuideCodeAnswers> {
  const highlight = await prompts.codeHighlight({
    current: current?.highlight,
  });
  const theme = current?.theme ?? DEFAULT_CODE_THEME;
  if (!highlight) {
    return {
      highlight: false,
      theme,
      lineNumbers: false,
      transformerNotation: false,
    };
  }

  return {
    highlight: true,
    theme: await prompts.codeTheme({ current: theme }),
    lineNumbers: await prompts.codeLineNumbers({
      current: current?.highlight ? current.lineNumbers : false,
    }),
    transformerNotation: await prompts.codeTransformerNotation({
      current: current?.highlight ? current.transformerNotation : false,
    }),
  };
}

async function collectPageNumbers(
  prompts: MarkdownPdfFormalGuidePrompts,
  current?: Readonly<MarkdownPdfFormalGuidePageNumberAnswers>,
): Promise<MarkdownPdfFormalGuidePageNumberAnswers> {
  const retained = current ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers;
  const enabled = await prompts.pageNumbersEnabled({ current: current?.enabled });
  if (!enabled) {
    const answers: MarkdownPdfFormalGuidePageNumberAnswers = {
      enabled: false,
      position: retained.position,
      format: retained.format,
      scope: retained.scope,
      countFrom: retained.countFrom,
      start: retained.start,
      increment: retained.increment,
    };
    compileMarkdownPdfFormalGuidePageNumbers(answers);
    return answers;
  }

  const currentOutcome = retained.scope === retained.countFrom ? retained.scope : undefined;
  const outcome = await prompts.pageNumberOutcome({ current: currentOutcome });
  const answers: MarkdownPdfFormalGuidePageNumberAnswers = {
    enabled: true,
    scope: outcome,
    countFrom: outcome,
    start: 1,
    increment: 1,
    format: await prompts.pageNumberLabel({ current: current?.format }),
    position: await prompts.pageNumberPosition({ current: retained.position }),
  };
  compileMarkdownPdfFormalGuidePageNumbers(answers);
  return answers;
}

function pageChromeAreaHasContent(
  area: Readonly<MarkdownPdfFormalGuidePageChromeAreaAnswers>,
): boolean {
  return (["left", "center", "right"] as const).some((slot) => area[slot].trim().length > 0);
}

function pageChromeHasContent(
  current: Readonly<MarkdownPdfFormalGuidePageChromeAnswers> | undefined,
): boolean {
  return Boolean(
    current &&
    (pageChromeAreaHasContent(current.header) || pageChromeAreaHasContent(current.footer)),
  );
}

function clearedPageChromeArea(
  current: Readonly<MarkdownPdfFormalGuidePageChromeAreaAnswers> | undefined,
): MarkdownPdfFormalGuidePageChromeAreaAnswers {
  return {
    left: "",
    center: "",
    right: "",
    ...(current?.style ? { style: current.style } : {}),
  };
}

function pageChromeContentAt(
  current: Readonly<MarkdownPdfFormalGuidePageChromeAnswers> | undefined,
  position: MarkdownPdfPageChromePosition,
): string {
  if (!current) {
    return "";
  }
  const target = resolveMarkdownPdfPageNumberSlot(position);
  return current[target.area][target.slot];
}

function setPageChromeContent(
  answers: MarkdownPdfFormalGuidePageChromeAnswers,
  position: MarkdownPdfPageChromePosition,
  value: string,
): void {
  const target = resolveMarkdownPdfPageNumberSlot(position);
  answers[target.area][target.slot] = value;
}

function selectedPageChromePositions(
  current: Readonly<MarkdownPdfFormalGuidePageChromeAnswers> | undefined,
  available: readonly MarkdownPdfPageChromePosition[],
): MarkdownPdfPageChromePosition[] {
  return available.filter((position) => pageChromeContentAt(current, position).trim());
}

async function collectPageChrome(
  prompts: MarkdownPdfFormalGuidePrompts,
  pageNumbers: Readonly<MarkdownPdfFormalGuidePageNumberAnswers>,
  current?: Readonly<MarkdownPdfFormalGuidePageChromeAnswers>,
): Promise<MarkdownPdfFormalGuidePageChromeAnswers> {
  const enabled = await prompts.repeatingContentEnabled({
    current: current ? pageChromeHasContent(current) : undefined,
  });
  const reservedPosition = pageNumbers.enabled ? pageNumbers.position : undefined;
  const reservedContent = reservedPosition ? pageChromeContentAt(current, reservedPosition) : "";
  const clearReserved =
    reservedPosition && reservedContent.trim()
      ? await prompts.clearOccupiedPageNumberPosition({
          current: reservedContent,
          position: reservedPosition,
        })
      : false;
  const available = MARKDOWN_PDF_PAGE_CHROME_POSITIONS.filter(
    (position) => position !== reservedPosition,
  );
  const answers: MarkdownPdfFormalGuidePageChromeAnswers = {
    header: clearedPageChromeArea(current?.header),
    footer: clearedPageChromeArea(current?.footer),
  };
  if (reservedPosition && reservedContent && !clearReserved) {
    setPageChromeContent(answers, reservedPosition, reservedContent);
  }
  if (enabled) {
    const positions = await prompts.repeatingContentPositions({
      available,
      current: current ? selectedPageChromePositions(current, available) : undefined,
      ...(reservedPosition ? { reserved: reservedPosition } : {}),
    });
    const availablePositions = new Set(available);
    for (const position of positions) {
      if (!availablePositions.has(position)) {
        throw new Error(`Repeating-content position is not available: ${position}`);
      }
      const currentContent = pageChromeContentAt(current, position);
      setPageChromeContent(
        answers,
        position,
        await prompts.repeatingContent({
          position,
          ...(currentContent ? { current: currentContent } : {}),
        }),
      );
    }
  }
  compileMarkdownPdfFormalGuidePageChrome(answers);
  return answers;
}

async function collectLayout(
  prompts: MarkdownPdfFormalGuidePrompts,
  current?: Readonly<MarkdownPdfFormalGuideLayoutAnswers>,
): Promise<MarkdownPdfFormalGuideLayoutAnswers> {
  return await prompts.layout({ current });
}

async function collectMargins(
  prompts: MarkdownPdfFormalGuidePrompts,
  layout: Readonly<MarkdownPdfFormalGuideLayoutAnswers>,
  current?: Readonly<MarkdownPdfFormalGuideMarginAnswers>,
): Promise<MarkdownPdfFormalGuideMarginAnswers> {
  return await prompts.margins({ current, layout });
}

function tocDetailsFrom(
  current: Readonly<MarkdownPdfFormalGuideTocAnswers> | undefined,
): Readonly<MarkdownPdfFormalGuideTocDetails> | undefined {
  if (!current?.enabled) {
    return undefined;
  }

  return {
    depth: current.depth,
    pageBreak: current.pageBreak,
  };
}

async function collectToc(
  prompts: MarkdownPdfFormalGuidePrompts,
  current?: Readonly<MarkdownPdfFormalGuideTocAnswers>,
): Promise<MarkdownPdfFormalGuideTocAnswers> {
  const enabled = await prompts.tocEnabled({ current: current?.enabled });
  if (!enabled) {
    return { enabled: false };
  }

  const details = await prompts.tocDetails({
    current: tocDetailsFrom(current),
  });
  return { enabled: true, ...details };
}

export async function collectMarkdownPdfFormalGuideAnswers(
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfFormalGuideAnswers> {
  const layout = await collectLayout(prompts);

  return {
    layout,
    margins: await collectMargins(prompts, layout),
    toc: await collectToc(prompts),
  };
}

export async function collectMarkdownPdfProfileFormalGuideAnswers(
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfProfileFormalGuideAnswers> {
  const shared = await collectMarkdownPdfFormalGuideAnswers(prompts);
  const code = await collectCode(prompts);
  const pageNumbers = await collectPageNumbers(prompts);
  return {
    ...shared,
    code,
    pageNumbers,
    pageChrome: await collectPageChrome(prompts, pageNumbers),
  };
}

export async function reviseMarkdownPdfFormalGuideCode(
  answers: Readonly<MarkdownPdfProfileFormalGuideAnswers>,
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfProfileFormalGuideAnswers> {
  return {
    ...answers,
    code: await collectCode(prompts, answers.code),
  };
}

export async function reviseMarkdownPdfFormalGuidePageNumbers(
  answers: Readonly<MarkdownPdfProfileFormalGuideAnswers>,
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfProfileFormalGuideAnswers> {
  return {
    ...answers,
    pageNumbers: await collectPageNumbers(prompts, answers.pageNumbers),
  };
}

export async function reviseMarkdownPdfFormalGuidePageChrome(
  answers: Readonly<MarkdownPdfProfileFormalGuideAnswers>,
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfProfileFormalGuideAnswers> {
  return {
    ...answers,
    pageChrome: await collectPageChrome(prompts, answers.pageNumbers, answers.pageChrome),
  };
}

export async function reviseMarkdownPdfFormalGuideLayout<
  TAnswers extends MarkdownPdfFormalGuideAnswers,
>(answers: Readonly<TAnswers>, prompts: MarkdownPdfFormalGuidePrompts): Promise<TAnswers> {
  return {
    ...answers,
    layout: await collectLayout(prompts, answers.layout),
  };
}

export async function reviseMarkdownPdfFormalGuideMargins<
  TAnswers extends MarkdownPdfFormalGuideAnswers,
>(answers: Readonly<TAnswers>, prompts: MarkdownPdfFormalGuidePrompts): Promise<TAnswers> {
  return {
    ...answers,
    margins: await collectMargins(prompts, answers.layout, answers.margins),
  };
}

export async function reviseMarkdownPdfFormalGuideToc<
  TAnswers extends MarkdownPdfFormalGuideAnswers,
>(answers: Readonly<TAnswers>, prompts: MarkdownPdfFormalGuidePrompts): Promise<TAnswers> {
  return {
    ...answers,
    toc: await collectToc(prompts, answers.toc),
  };
}
