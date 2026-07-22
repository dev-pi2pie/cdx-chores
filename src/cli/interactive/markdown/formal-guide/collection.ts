import type {
  MarkdownPdfFormalGuideAnswers,
  MarkdownPdfFormalGuideLayoutAnswers,
  MarkdownPdfFormalGuideMarginAnswers,
  MarkdownPdfFormalGuidePrompts,
  MarkdownPdfFormalGuideTocAnswers,
  MarkdownPdfFormalGuideTocDetails,
} from "./types";

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

  const details = await prompts.tocDetails({ current: tocDetailsFrom(current) });
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
