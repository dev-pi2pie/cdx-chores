import { CliError } from "../../errors";
import type {
  MarkdownPdfPageChromePosition,
  MarkdownPdfPageNumberCountOrigin,
  MarkdownPdfPageNumberScope,
} from "../profile/types";

/** Internal Interactive input. An omitted group has no effect on the candidate. */
export interface MarkdownPdfCodexPageInformationInput {
  pageNumbers?: {
    enabled: boolean;
    position: MarkdownPdfPageChromePosition;
    format: string;
    scope: MarkdownPdfPageNumberScope;
    countFrom: MarkdownPdfPageNumberCountOrigin;
    start: number;
    increment: number;
  };
  repeatingContent?: {
    enabled: boolean;
    selected: readonly MarkdownPdfPageChromePosition[];
    text: Partial<Record<MarkdownPdfPageChromePosition, string>>;
  };
  // Collector-only conflict data is deliberately outside this type.
}

export interface MarkdownPdfCodexPageInformationSignal {
  pageNumbers?:
    | { enabled: false }
    | {
        enabled: true;
        position: MarkdownPdfPageChromePosition;
        format: string;
        scope: MarkdownPdfPageNumberScope;
        countFrom: MarkdownPdfPageNumberCountOrigin;
        start: number;
        increment: number;
      };
  repeatingContent?:
    | { enabled: false }
    | {
        enabled: true;
        selected: readonly MarkdownPdfPageChromePosition[];
        text: Partial<Record<MarkdownPdfPageChromePosition, string>>;
      };
}

export const MARKDOWN_PDF_CODEX_PAGE_TEXT_MAX_LENGTH = 512;

export function hasExplicitMarkdownPdfCodexPageInformation(
  input: MarkdownPdfCodexPageInformationInput | undefined,
): boolean {
  return input?.pageNumbers !== undefined || input?.repeatingContent !== undefined;
}

function assertBoundedPageText(value: string, field: string): void {
  if (value.length > MARKDOWN_PDF_CODEX_PAGE_TEXT_MAX_LENGTH) {
    throw new CliError(
      `${field} exceeds the ${MARKDOWN_PDF_CODEX_PAGE_TEXT_MAX_LENGTH}-character page-information limit.`,
      { code: "INVALID_INPUT", exitCode: 2 },
    );
  }
}

function assertGuidedPageNumbers(
  pageNumbers: NonNullable<MarkdownPdfCodexPageInformationInput["pageNumbers"]>,
): void {
  if (typeof pageNumbers.format !== "string" || pageNumbers.format.trim().length === 0) {
    throw new CliError("Page-number label must not be empty.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (
    (pageNumbers.scope !== "body" && pageNumbers.scope !== "document") ||
    pageNumbers.scope !== pageNumbers.countFrom ||
    pageNumbers.start !== 1 ||
    pageNumbers.increment !== 1
  ) {
    throw new CliError(
      "Page-number settings must use one guided body/document outcome and count from 1.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  assertBoundedPageText(pageNumbers.format, "Page-number label");
}

/** Copy only active authored values; never copy OFF drafts or collector conflict data. */
export function prepareMarkdownPdfCodexPageInformationSignal(
  input: MarkdownPdfCodexPageInformationInput | undefined,
): MarkdownPdfCodexPageInformationSignal | undefined {
  if (!hasExplicitMarkdownPdfCodexPageInformation(input)) {
    return undefined;
  }
  const pageNumbers = input?.pageNumbers;
  const repeatingContent = input?.repeatingContent;
  if (pageNumbers?.enabled) {
    assertGuidedPageNumbers(pageNumbers);
  }
  const selectedText: Partial<Record<MarkdownPdfPageChromePosition, string>> = {};
  if (repeatingContent?.enabled) {
    for (const position of repeatingContent.selected) {
      const value = repeatingContent.text[position];
      if (value === undefined || value.trim().length === 0) {
        throw new CliError(`Repeating content at ${position} must not be empty.`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      assertBoundedPageText(value, `Repeating content at ${position}`);
      selectedText[position] = value;
    }
  }
  return {
    ...(pageNumbers
      ? {
          pageNumbers: pageNumbers.enabled
            ? {
                enabled: true as const,
                position: pageNumbers.position,
                format: pageNumbers.format,
                scope: pageNumbers.scope,
                countFrom: pageNumbers.countFrom,
                start: pageNumbers.start,
                increment: pageNumbers.increment,
              }
            : { enabled: false as const },
        }
      : {}),
    ...(repeatingContent
      ? {
          repeatingContent: repeatingContent.enabled
            ? {
                enabled: true as const,
                selected: [...repeatingContent.selected],
                text: selectedText,
              }
            : { enabled: false as const },
        }
      : {}),
  };
}
