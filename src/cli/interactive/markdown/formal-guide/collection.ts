import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS,
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
  MarkdownPdfFormalGuidePageNumberAnswers,
  MarkdownPdfFormalGuidePageNumberDetails,
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

function pageNumberDetailsFrom(
  current: Readonly<MarkdownPdfFormalGuidePageNumberAnswers>,
): MarkdownPdfFormalGuidePageNumberDetails {
  return {
    position: current.position,
    format: current.format,
    countFrom: current.countFrom,
    start: current.start,
    increment: current.increment,
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

  const scope = await prompts.pageNumberScope({ current: retained.scope });
  const countFromChoices =
    scope === "document"
      ? MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS.filter((value) => value === "document")
      : MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS;
  const details = await prompts.pageNumberDetails({
    countFromChoices,
    current: pageNumberDetailsFrom(retained),
    scope,
  });
  const answers: MarkdownPdfFormalGuidePageNumberAnswers = { enabled: true, scope, ...details };
  compileMarkdownPdfFormalGuidePageNumbers(answers);
  return answers;
}

async function collectPageChrome(
  prompts: MarkdownPdfFormalGuidePrompts,
  current?: Readonly<MarkdownPdfFormalGuidePageChromeAnswers>,
): Promise<MarkdownPdfFormalGuidePageChromeAnswers> {
  const answers: MarkdownPdfFormalGuidePageChromeAnswers = {
    header: await prompts.pageChromeArea({ area: "header", current: current?.header }),
    footer: await prompts.pageChromeArea({ area: "footer", current: current?.footer }),
  };
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
  return {
    ...(await collectMarkdownPdfFormalGuideAnswers(prompts)),
    code: await collectCode(prompts),
    pageNumbers: await collectPageNumbers(prompts),
    pageChrome: await collectPageChrome(prompts),
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
    pageChrome: await collectPageChrome(prompts, answers.pageChrome),
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
