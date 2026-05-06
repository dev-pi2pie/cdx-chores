import { CliError } from "../errors";

export const MARKDOWN_PDF_PRESETS = [
  "article",
  "report",
  "wide-table",
  "compact",
  "reader",
] as const;
export type MarkdownPdfPreset = (typeof MARKDOWN_PDF_PRESETS)[number];

export const MARKDOWN_PDF_ORIENTATIONS = ["portrait", "landscape"] as const;
export type MarkdownPdfOrientation = (typeof MARKDOWN_PDF_ORIENTATIONS)[number];

export const MARKDOWN_PDF_TOC_PAGE_BREAKS = ["auto", "none", "before", "after", "both"] as const;
export type MarkdownPdfTocPageBreak = (typeof MARKDOWN_PDF_TOC_PAGE_BREAKS)[number];

export const MARKDOWN_PDF_PAGE_SIZES = ["A3", "A4", "A5", "Letter", "Legal", "Tabloid"] as const;
export type MarkdownPdfPageSize = (typeof MARKDOWN_PDF_PAGE_SIZES)[number];

export interface MarkdownPdfMarginInput {
  margin?: string;
  marginX?: string;
  marginY?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
}

export interface NormalizedMarkdownPdfOptions {
  preset: MarkdownPdfPreset;
  pageSize: MarkdownPdfPageSize;
  orientation: MarkdownPdfOrientation;
  margins: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  toc: boolean;
  tocDepth: number;
  tocPageBreak: MarkdownPdfTocPageBreak;
  allowRemoteAssets: boolean;
}

export interface NormalizeMarkdownPdfOptionsInput extends MarkdownPdfMarginInput {
  preset?: string;
  pageSize?: string;
  orientation?: string;
  toc?: boolean;
  tocDepth?: number;
  tocPageBreak?: string;
  allowRemoteAssets?: boolean;
}

const DEFAULTS: NormalizedMarkdownPdfOptions = {
  preset: "article",
  pageSize: "A4",
  orientation: "portrait",
  margins: {
    top: "18mm",
    right: "18mm",
    bottom: "18mm",
    left: "18mm",
  },
  toc: false,
  tocDepth: 3,
  tocPageBreak: "auto",
  allowRemoteAssets: false,
};

const PRESET_DEFAULTS: Record<
  MarkdownPdfPreset,
  Partial<Pick<NormalizedMarkdownPdfOptions, "orientation">> & {
    margins?: NormalizedMarkdownPdfOptions["margins"];
  }
> = {
  article: {},
  report: {},
  "wide-table": {
    orientation: "landscape",
    margins: {
      top: "12mm",
      right: "12mm",
      bottom: "12mm",
      left: "12mm",
    },
  },
  compact: {
    margins: {
      top: "12mm",
      right: "12mm",
      bottom: "12mm",
      left: "12mm",
    },
  },
  reader: {
    margins: {
      top: "20mm",
      right: "22mm",
      bottom: "20mm",
      left: "22mm",
    },
  },
};

const PAGE_SIZE_BY_LOWERCASE = new Map<string, MarkdownPdfPageSize>(
  MARKDOWN_PDF_PAGE_SIZES.map((value) => [value.toLowerCase(), value]),
);

function parseChoice<T extends readonly string[]>(
  rawValue: string | undefined,
  values: T,
  label: string,
  defaultValue: T[number],
): T[number] {
  const value = rawValue?.trim().toLowerCase();
  if (!value) {
    return defaultValue;
  }

  const matched = values.find((candidate) => candidate.toLowerCase() === value);
  if (matched) {
    return matched;
  }

  throw new CliError(`${label} must be one of: ${values.join(", ")}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function parsePageSize(value: string | undefined): MarkdownPdfPageSize {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return DEFAULTS.pageSize;
  }

  const matched = PAGE_SIZE_BY_LOWERCASE.get(normalized);
  if (matched) {
    return matched;
  }

  throw new CliError(`Page size must be one of: ${MARKDOWN_PDF_PAGE_SIZES.join(", ")}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

const CSS_LENGTH_PATTERN = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:mm|cm|in|pt|px))$/i;

export function validateMarkdownPdfCssLength(value: string, label: string): string {
  const normalized = value.trim();
  if (!CSS_LENGTH_PATTERN.test(normalized)) {
    throw new CliError(`${label} must be a CSS length using one of: mm, cm, in, pt, px.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return normalized.toLowerCase();
}

function parseTocDepth(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULTS.tocDepth;
  }

  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new CliError("ToC depth must be an integer from 1 to 6.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function resolveMargins(input: MarkdownPdfMarginInput, preset: MarkdownPdfPreset) {
  const presetMargins = PRESET_DEFAULTS[preset].margins ?? DEFAULTS.margins;
  const base = input.margin
    ? {
        top: validateMarkdownPdfCssLength(input.margin, "--margin"),
        right: validateMarkdownPdfCssLength(input.margin, "--margin"),
        bottom: validateMarkdownPdfCssLength(input.margin, "--margin"),
        left: validateMarkdownPdfCssLength(input.margin, "--margin"),
      }
    : { ...presetMargins };

  if (input.marginX) {
    const marginX = validateMarkdownPdfCssLength(input.marginX, "--margin-x");
    base.left = marginX;
    base.right = marginX;
  }
  if (input.marginY) {
    const marginY = validateMarkdownPdfCssLength(input.marginY, "--margin-y");
    base.top = marginY;
    base.bottom = marginY;
  }
  if (input.marginTop) {
    base.top = validateMarkdownPdfCssLength(input.marginTop, "--margin-top");
  }
  if (input.marginRight) {
    base.right = validateMarkdownPdfCssLength(input.marginRight, "--margin-right");
  }
  if (input.marginBottom) {
    base.bottom = validateMarkdownPdfCssLength(input.marginBottom, "--margin-bottom");
  }
  if (input.marginLeft) {
    base.left = validateMarkdownPdfCssLength(input.marginLeft, "--margin-left");
  }

  return base;
}

export function normalizeMarkdownPdfOptions(
  input: NormalizeMarkdownPdfOptionsInput = {},
): NormalizedMarkdownPdfOptions {
  const preset = parseChoice(input.preset, MARKDOWN_PDF_PRESETS, "Preset", DEFAULTS.preset);
  const presetDefaults = PRESET_DEFAULTS[preset];
  const pageSize = parsePageSize(input.pageSize);
  const orientation = parseChoice(
    input.orientation,
    MARKDOWN_PDF_ORIENTATIONS,
    "Orientation",
    presetDefaults.orientation ?? DEFAULTS.orientation,
  );
  const tocPageBreak = parseChoice(
    input.tocPageBreak,
    MARKDOWN_PDF_TOC_PAGE_BREAKS,
    "ToC page break",
    DEFAULTS.tocPageBreak,
  );

  return {
    preset,
    pageSize,
    orientation,
    margins: resolveMargins(input, preset),
    toc: input.toc ?? DEFAULTS.toc,
    tocDepth: parseTocDepth(input.tocDepth),
    tocPageBreak,
    allowRemoteAssets: input.allowRemoteAssets ?? DEFAULTS.allowRemoteAssets,
  };
}
