import { CliError } from "../../errors";
import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import { DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE } from "./defaults";
import { validateMarkdownPdfBodyFontKey } from "./schema";
import type {
  EffectiveMarkdownPdfCodeOptions,
  MarkdownPdfCodeTheme,
  MarkdownPdfCoverStyle,
  MarkdownPdfFontConfig,
  MarkdownPdfMetadata,
  MarkdownPdfPageChromePosition,
  MarkdownPdfPageChromeSlots,
  MarkdownPdfProfileLoadResult,
  MarkdownPdfProfileMergeInput,
  NormalizedMarkdownPdfCode,
  NormalizedMarkdownPdfCover,
  NormalizedMarkdownPdfFonts,
  NormalizedMarkdownPdfPageNumbers,
} from "./types";
import { MARKDOWN_PDF_CODE_THEMES } from "./types";

const META_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const PAGE_NUMBER_POSITIONS = new Set<MarkdownPdfPageChromePosition>([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
const COVER_STYLES = new Set<MarkdownPdfCoverStyle>(["plain", "report"]);
const CODE_THEMES = new Set<MarkdownPdfCodeTheme>(MARKDOWN_PDF_CODE_THEMES);

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function metadataValueToString(value: unknown): string | null {
  if (isScalar(value)) {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value) && value.every(isScalar)) {
    return value.map(String).join(", ");
  }
  return null;
}

function normalizeMetadata(input: unknown, label: string): MarkdownPdfMetadata {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new CliError(`${label} must be an object.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const output: MarkdownPdfMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = metadataValueToString(value);
    if (normalized !== null) {
      output[key] = normalized;
    }
  }
  return output;
}

function parseMetaOverrides(values: string[] | undefined): MarkdownPdfMetadata {
  const output: MarkdownPdfMetadata = {};
  for (const raw of values ?? []) {
    const separatorIndex = raw.indexOf("=");
    if (separatorIndex <= 0) {
      throw new CliError("--meta must use key=value.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    const key = raw.slice(0, separatorIndex).trim();
    const value = raw.slice(separatorIndex + 1);
    if (!META_KEY_PATTERN.test(key)) {
      throw new CliError(
        "--meta key must start with a letter and use letters, numbers, _, ., or -.",
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    output[key] = value;
  }
  return output;
}

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readStringArray(value: unknown, label: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CliError(`${label} must be an array of strings.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function stringValue(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new CliError(`${label} must be a string.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new CliError(`${label} must be a boolean.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function numberValue(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new CliError(`${label} must be an integer.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function normalizeChromeSlots(value: unknown, label: string): MarkdownPdfPageChromeSlots {
  const input = readObject(value);
  return {
    left: stringValue(input.left, `${label}.left`) ?? "",
    center: stringValue(input.center, `${label}.center`) ?? "",
    right: stringValue(input.right, `${label}.right`) ?? "",
  };
}

function normalizePageNumbers(value: unknown): NormalizedMarkdownPdfPageNumbers {
  const input = readObject(value);
  const position =
    stringValue(input.position, "profile.pageNumbers.position") ??
    DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.position;

  if (!PAGE_NUMBER_POSITIONS.has(position as MarkdownPdfPageChromePosition)) {
    throw new CliError(
      "profile.pageNumbers.position must be one of: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const scope =
    stringValue(input.scope, "profile.pageNumbers.scope") ??
    DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.scope;
  if (scope !== "body") {
    throw new CliError("profile.pageNumbers.scope must be body.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    enabled:
      booleanValue(input.enabled, "profile.pageNumbers.enabled") ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.enabled,
    position: position as MarkdownPdfPageChromePosition,
    format:
      stringValue(input.format, "profile.pageNumbers.format") ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers.format,
    scope,
  };
}

function normalizeCover(value: unknown): NormalizedMarkdownPdfCover {
  const input = readObject(value);
  const style =
    stringValue(input.style, "profile.cover.style") ??
    DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.cover.style;
  if (!COVER_STYLES.has(style as MarkdownPdfCoverStyle)) {
    throw new CliError("profile.cover.style must be one of: plain, report.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const fields = readObject(input.fields);
  const defaultFields = DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.cover.fields;
  return {
    enabled:
      booleanValue(input.enabled, "profile.cover.enabled") ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.cover.enabled,
    style: style as MarkdownPdfCoverStyle,
    fields: {
      title: stringValue(fields.title, "profile.cover.fields.title") ?? defaultFields.title,
      subtitle:
        stringValue(fields.subtitle, "profile.cover.fields.subtitle") ?? defaultFields.subtitle,
      author: stringValue(fields.author, "profile.cover.fields.author") ?? defaultFields.author,
      company: stringValue(fields.company, "profile.cover.fields.company") ?? defaultFields.company,
      date: stringValue(fields.date, "profile.cover.fields.date") ?? defaultFields.date,
    },
  };
}

function normalizeCode(value: unknown): NormalizedMarkdownPdfCode {
  const input = readObject(value);
  const theme =
    stringValue(input.theme, "profile.code.theme") ??
    DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code.theme;
  if (!CODE_THEMES.has(theme as MarkdownPdfCodeTheme)) {
    throw new CliError(
      `profile.code.theme must be one of: ${MARKDOWN_PDF_CODE_THEMES.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    highlight:
      booleanValue(input.highlight, "profile.code.highlight") ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code.highlight,
    theme: theme as MarkdownPdfCodeTheme,
    lineNumbers:
      booleanValue(input.lineNumbers, "profile.code.lineNumbers") ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code.lineNumbers,
    transformerNotation:
      booleanValue(input.transformerNotation, "profile.code.transformerNotation") ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code.transformerNotation,
  };
}

export function resolveMarkdownPdfCodeOptions(input: {
  profile: NormalizedMarkdownPdfCode;
  cliHighlight?: boolean;
}): EffectiveMarkdownPdfCodeOptions {
  if (input.cliHighlight === false) {
    return {
      ...input.profile,
      highlight: false,
      lineNumbers: false,
      transformerNotation: false,
    };
  }

  const highlight = input.cliHighlight === true ? true : input.profile.highlight;
  if (input.profile.lineNumbers && !highlight) {
    throw new CliError(
      "profile.code.lineNumbers requires code.highlight: true or --code-highlight.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  if (input.profile.transformerNotation && !highlight) {
    throw new CliError(
      "profile.code.transformerNotation requires code.highlight: true or --code-highlight.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    ...input.profile,
    highlight,
    lineNumbers: highlight ? input.profile.lineNumbers : false,
    transformerNotation: highlight ? input.profile.transformerNotation : false,
  };
}

function normalizeFontConfig(value: unknown, label: string): MarkdownPdfFontConfig {
  const input = readObject(value);
  const output: MarkdownPdfFontConfig = {};
  for (const [key, font] of Object.entries(input)) {
    output[key] = stringValue(font, `${label}.${key}`) ?? "";
  }
  return output;
}

function normalizeFonts(value: unknown): NormalizedMarkdownPdfFonts {
  const input = readObject(value);
  const fonts: NormalizedMarkdownPdfFonts = {
    body: normalizeFontConfig(input.body, "profile.fonts.body"),
    heading: normalizeFontConfig(input.heading, "profile.fonts.heading"),
    code: normalizeFontConfig(input.code, "profile.fonts.code"),
    pageChrome: normalizeFontConfig(input.pageChrome, "profile.fonts.pageChrome"),
  };

  for (const key of Object.keys(fonts.body)) {
    validateMarkdownPdfBodyFontKey(key);
  }

  return fonts;
}

function contentLangsFromSource(source: Record<string, unknown>): string[] {
  const pdf = readObject(source.pdf);
  return readStringArray(pdf["content-langs"], "profile.pdf.content-langs");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function markdownPdfProfileToRecipeOptions(
  profile: Record<string, unknown> = {},
): NormalizeMarkdownPdfOptionsInput {
  const page = readObject(profile.page);
  const toc = readObject(profile.toc);
  return {
    pageSize: stringValue(page.size, "profile.page.size"),
    orientation: stringValue(page.orientation, "profile.page.orientation"),
    margin: stringValue(page.margin, "profile.page.margin"),
    marginX: stringValue(page.marginX, "profile.page.marginX"),
    marginY: stringValue(page.marginY, "profile.page.marginY"),
    marginTop: stringValue(page.marginTop, "profile.page.marginTop"),
    marginRight: stringValue(page.marginRight, "profile.page.marginRight"),
    marginBottom: stringValue(page.marginBottom, "profile.page.marginBottom"),
    marginLeft: stringValue(page.marginLeft, "profile.page.marginLeft"),
    toc: booleanValue(toc.enabled, "profile.toc.enabled"),
    tocDepth: numberValue(toc.depth, "profile.toc.depth"),
    tocPageBreak: stringValue(toc.pageBreak, "profile.toc.pageBreak"),
  };
}

export function normalizeMarkdownPdfProfile(
  input: MarkdownPdfProfileMergeInput = {},
): MarkdownPdfProfileLoadResult {
  const profile = input.profile ?? {};
  const profileMetadata = normalizeMetadata(profile.metadata, "profile.metadata");
  const frontmatterMetadata = normalizeMetadata(input.frontmatter, "Markdown frontmatter");
  const cliMetadata = parseMetaOverrides(input.meta);
  const frontmatterContentLangs = input.frontmatter
    ? contentLangsFromSource(input.frontmatter)
    : [];

  return {
    profile: {
      metadata: {
        ...profileMetadata,
        ...frontmatterMetadata,
        ...cliMetadata,
      },
      code: normalizeCode(profile.code),
      header: normalizeChromeSlots(profile.header, "profile.header"),
      footer: normalizeChromeSlots(profile.footer, "profile.footer"),
      pageNumbers: normalizePageNumbers(profile.pageNumbers),
      cover: normalizeCover(profile.cover),
      fonts: normalizeFonts(profile.fonts),
      contentLangs: uniqueStrings([...contentLangsFromSource(profile), ...frontmatterContentLangs]),
    },
    recipeOptions: markdownPdfProfileToRecipeOptions(profile),
  };
}
