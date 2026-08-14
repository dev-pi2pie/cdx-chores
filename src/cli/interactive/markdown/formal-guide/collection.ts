import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  resolveMarkdownPdfPageNumberSlot,
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
  MarkdownPdfFormalGuidePageChromeSelection,
  MarkdownPdfFormalGuidePageChromeSlot,
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

  const outcome = await prompts.pageNumberOutcome({ current: retained.scope });
  const answers: MarkdownPdfFormalGuidePageNumberAnswers = {
    enabled: true,
    scope: outcome,
    countFrom: outcome,
    start: 1,
    increment: 1,
    position: await prompts.pageNumberPosition({ current: retained.position }),
    format: "{page}",
  };
  compileMarkdownPdfFormalGuidePageNumbers(answers);
  return answers;
}

const PAGE_CHROME_SLOTS = ["left", "center", "right"] as const;

function pageChromeAreaHasContent(
  area: Readonly<MarkdownPdfFormalGuidePageChromeAreaAnswers>,
): boolean {
  return PAGE_CHROME_SLOTS.some((slot) => area[slot].trim().length > 0);
}

function pageChromeSelectionFrom(
  current: Readonly<MarkdownPdfFormalGuidePageChromeAnswers> | undefined,
): MarkdownPdfFormalGuidePageChromeSelection | undefined {
  if (!current) {
    return undefined;
  }
  const header = pageChromeAreaHasContent(current.header);
  const footer = pageChromeAreaHasContent(current.footer);
  if (header && footer) {
    return "both";
  }
  if (header) {
    return "header";
  }
  if (footer) {
    return "footer";
  }
  return "none";
}

function pageChromeSelectionIncludes(
  selection: MarkdownPdfFormalGuidePageChromeSelection,
  area: "header" | "footer",
): boolean {
  return selection === "both" || selection === area;
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

function pageChromeSlotsToPrompt(input: {
  area: "header" | "footer";
  current: Readonly<MarkdownPdfFormalGuidePageChromeAreaAnswers> | undefined;
  pageNumbers: Readonly<MarkdownPdfFormalGuidePageNumberAnswers>;
}): readonly MarkdownPdfFormalGuidePageChromeSlot[] {
  if (!input.pageNumbers.enabled) {
    return PAGE_CHROME_SLOTS;
  }

  const target = resolveMarkdownPdfPageNumberSlot(input.pageNumbers.position);
  if (target.area !== input.area || input.current?.[target.slot].trim()) {
    return PAGE_CHROME_SLOTS;
  }
  return PAGE_CHROME_SLOTS.filter((slot) => slot !== target.slot);
}

async function collectPageChromeArea(input: {
  area: "header" | "footer";
  current: Readonly<MarkdownPdfFormalGuidePageChromeAreaAnswers> | undefined;
  pageNumbers: Readonly<MarkdownPdfFormalGuidePageNumberAnswers>;
  prompts: MarkdownPdfFormalGuidePrompts;
}): Promise<MarkdownPdfFormalGuidePageChromeAreaAnswers> {
  const slots = pageChromeSlotsToPrompt(input);
  const prompted = await input.prompts.pageChromeArea({
    area: input.area,
    current: input.current,
    slots,
  });
  const promptedSlots = new Set(slots);
  return {
    left: promptedSlots.has("left") ? prompted.left : (input.current?.left ?? ""),
    center: promptedSlots.has("center") ? prompted.center : (input.current?.center ?? ""),
    right: promptedSlots.has("right") ? prompted.right : (input.current?.right ?? ""),
    ...(input.current?.style
      ? { style: input.current.style }
      : prompted.style
        ? { style: prompted.style }
        : {}),
  };
}

async function collectPageChrome(
  prompts: MarkdownPdfFormalGuidePrompts,
  pageNumbers: Readonly<MarkdownPdfFormalGuidePageNumberAnswers>,
  current?: Readonly<MarkdownPdfFormalGuidePageChromeAnswers>,
): Promise<MarkdownPdfFormalGuidePageChromeAnswers> {
  const selection = await prompts.pageChromeSelection({
    current: pageChromeSelectionFrom(current),
  });
  const answers: MarkdownPdfFormalGuidePageChromeAnswers = {
    header: pageChromeSelectionIncludes(selection, "header")
      ? await collectPageChromeArea({
          area: "header",
          current: current?.header,
          pageNumbers,
          prompts,
        })
      : clearedPageChromeArea(current?.header),
    footer: pageChromeSelectionIncludes(selection, "footer")
      ? await collectPageChromeArea({
          area: "footer",
          current: current?.footer,
          pageNumbers,
          prompts,
        })
      : clearedPageChromeArea(current?.footer),
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
