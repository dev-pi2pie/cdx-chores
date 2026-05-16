import { extname } from "node:path";

import { CliError } from "../../errors";
import type { MarkdownPdfProfileFormat } from "./types";

const ROOT_KEYS = new Set([
  "page",
  "toc",
  "metadata",
  "pdf",
  "fonts",
  "cover",
  "header",
  "footer",
  "pageNumbers",
  "code",
]);
const PAGE_KEYS = new Set([
  "size",
  "orientation",
  "margin",
  "marginX",
  "marginY",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
]);
const TOC_KEYS = new Set(["enabled", "depth", "pageBreak"]);
const COVER_KEYS = new Set(["enabled", "style", "fields"]);
const COVER_FIELD_KEYS = new Set(["title", "subtitle", "author", "company", "date"]);
const CHROME_KEYS = new Set(["left", "center", "right"]);
const PAGE_NUMBER_KEYS = new Set(["enabled", "position", "format", "scope"]);
const CODE_KEYS = new Set(["highlight", "theme", "lineNumbers"]);
const PDF_KEYS = new Set(["content-langs"]);
const FONT_ROLE_KEYS = new Set(["body", "heading", "code", "pageChrome"]);
const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export function inferMarkdownPdfProfileFormat(path: string): MarkdownPdfProfileFormat {
  const extension = extname(path).toLowerCase();
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".yml" || extension === ".yaml") {
    return "yaml";
  }
  throw new CliError("Markdown PDF profile path must end with .yml, .yaml, or .json.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function assertPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new CliError(`${label} must be a plain object.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value as Record<string, unknown>;
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string,
): void {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new CliError(`Unknown Markdown PDF profile key: ${label}.${unknownKeys[0]}`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

function assertOptionalObject(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertPlainObject(value, label);
}

export function validateMarkdownPdfBodyFontKey(key: string): void {
  if (key === "default" || LANGUAGE_TAG_PATTERN.test(key)) {
    return;
  }
  throw new CliError(
    `profile.fonts.body.${key} must use default or a language tag such as zh-Hant, ja, or ko.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

export function validateMarkdownPdfProfileShape(profile: Record<string, unknown>): void {
  assertAllowedKeys(profile, ROOT_KEYS, "profile");
  const page = assertOptionalObject(profile.page, "profile.page");
  if (page) {
    assertAllowedKeys(page, PAGE_KEYS, "profile.page");
  }

  const toc = assertOptionalObject(profile.toc, "profile.toc");
  if (toc) {
    assertAllowedKeys(toc, TOC_KEYS, "profile.toc");
  }

  assertOptionalObject(profile.metadata, "profile.metadata");
  const pdf = assertOptionalObject(profile.pdf, "profile.pdf");
  if (pdf) {
    assertAllowedKeys(pdf, PDF_KEYS, "profile.pdf");
  }

  const fonts = assertOptionalObject(profile.fonts, "profile.fonts");
  if (fonts) {
    assertAllowedKeys(fonts, FONT_ROLE_KEYS, "profile.fonts");
    for (const [role, config] of Object.entries(fonts)) {
      const fontConfig = assertPlainObject(config, `profile.fonts.${role}`);
      if (role === "body") {
        for (const key of Object.keys(fontConfig)) {
          validateMarkdownPdfBodyFontKey(key);
        }
      }
    }
  }

  const cover = assertOptionalObject(profile.cover, "profile.cover");
  if (cover) {
    assertAllowedKeys(cover, COVER_KEYS, "profile.cover");
    const fields = assertOptionalObject(cover.fields, "profile.cover.fields");
    if (fields) {
      assertAllowedKeys(fields, COVER_FIELD_KEYS, "profile.cover.fields");
    }
  }

  const header = assertOptionalObject(profile.header, "profile.header");
  if (header) {
    assertAllowedKeys(header, CHROME_KEYS, "profile.header");
  }

  const footer = assertOptionalObject(profile.footer, "profile.footer");
  if (footer) {
    assertAllowedKeys(footer, CHROME_KEYS, "profile.footer");
  }

  const pageNumbers = assertOptionalObject(profile.pageNumbers, "profile.pageNumbers");
  if (pageNumbers) {
    assertAllowedKeys(pageNumbers, PAGE_NUMBER_KEYS, "profile.pageNumbers");
  }

  const code = assertOptionalObject(profile.code, "profile.code");
  if (code) {
    assertAllowedKeys(code, CODE_KEYS, "profile.code");
  }
}
