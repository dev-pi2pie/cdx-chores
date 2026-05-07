import { CliError } from "../../errors";
import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import { DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE } from "./defaults";
import type {
  MarkdownPdfMetadata,
  MarkdownPdfPageChromePosition,
  MarkdownPdfPageChromeSlots,
  MarkdownPdfProfileLoadResult,
  MarkdownPdfProfileMergeInput,
  NormalizedMarkdownPdfPageNumbers,
} from "./types";

const META_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const PAGE_NUMBER_POSITIONS = new Set<MarkdownPdfPageChromePosition>([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

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
  if (!Number.isInteger(value)) {
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

  return {
    profile: {
      metadata: {
        ...profileMetadata,
        ...frontmatterMetadata,
        ...cliMetadata,
      },
      header: normalizeChromeSlots(profile.header, "profile.header"),
      footer: normalizeChromeSlots(profile.footer, "profile.footer"),
      pageNumbers: normalizePageNumbers(profile.pageNumbers),
    },
    recipeOptions: markdownPdfProfileToRecipeOptions(profile),
  };
}
