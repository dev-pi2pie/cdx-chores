import type {
  MarkdownPdfFormalGuideAnswers,
  MarkdownPdfFormalGuideCodeAnswers,
  MarkdownPdfFormalGuideLayoutAnswers,
  MarkdownPdfFormalGuideMarginAnswers,
  MarkdownPdfFormalGuidePrompts,
  MarkdownPdfProfileFormalGuideAnswers,
  MarkdownPdfFormalGuideTocAnswers,
  MarkdownPdfFormalGuideTocDetails,
} from "./types";

const DEFAULT_CODE_THEME = "github-light";

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

export async function reviseMarkdownPdfFormalGuideLayout(
  answers: Readonly<MarkdownPdfFormalGuideAnswers>,
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfFormalGuideAnswers> {
  return {
    ...answers,
    layout: await collectLayout(prompts, answers.layout),
  };
}

export async function reviseMarkdownPdfFormalGuideMargins(
  answers: Readonly<MarkdownPdfFormalGuideAnswers>,
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfFormalGuideAnswers> {
  return {
    ...answers,
    margins: await collectMargins(prompts, answers.layout, answers.margins),
  };
}

export async function reviseMarkdownPdfFormalGuideToc(
  answers: Readonly<MarkdownPdfFormalGuideAnswers>,
  prompts: MarkdownPdfFormalGuidePrompts,
): Promise<MarkdownPdfFormalGuideAnswers> {
  return {
    ...answers,
    toc: await collectToc(prompts, answers.toc),
  };
}
