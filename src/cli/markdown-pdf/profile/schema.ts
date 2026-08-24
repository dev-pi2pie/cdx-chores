import { extname } from "node:path";

import { CliError } from "../../errors";
import { markdownPdfProfileFeatureAtPath, markdownPdfProfileFeatureKeys } from "./feature-registry";
import type { MarkdownPdfProfileFormat } from "./types";

export const MARKDOWN_PDF_PROFILE_ROOT_KEYS = Array.from(markdownPdfProfileFeatureKeys());

const MARKDOWN_PDF_PROFILE_ROOT_KEY_SCHEMA_SUMMARIES: Partial<Record<string, string[]>> = {
  page: ["page.size", "page.orientation", "page margins"],
  toc: ["toc.enabled", "toc.depth", "toc.pageBreak"],
  fonts: ["fonts.body", "fonts.heading", "fonts.code", "fonts.pageChrome"],
  titleBlock: ["titleBlock.metadataTitle"],
};

export const MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY = MARKDOWN_PDF_PROFILE_ROOT_KEYS.filter(
  (key) => key !== "profile" && key !== "schemaVersion",
).flatMap((key) => MARKDOWN_PDF_PROFILE_ROOT_KEY_SCHEMA_SUMMARIES[key] ?? [key]);

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
  allowedKeys: ReadonlySet<string>,
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

function validateRegisteredObject(
  value: Record<string, unknown>,
  path: string,
  label: string,
): void {
  assertAllowedKeys(value, markdownPdfProfileFeatureKeys(path), label);
  for (const [key, child] of Object.entries(value)) {
    const childPath = path.length > 0 ? `${path}.${key}` : key;
    const definition = markdownPdfProfileFeatureAtPath(childPath);
    if (!definition || (definition.kind !== "object" && definition.kind !== "dynamic-object")) {
      continue;
    }
    const childObject = assertPlainObject(child, `${label}.${key}`);
    if (childPath === "fonts.body") {
      for (const fontKey of Object.keys(childObject)) {
        validateMarkdownPdfBodyFontKey(fontKey);
      }
    }
    if (definition.kind === "object") {
      validateRegisteredObject(childObject, childPath, `${label}.${key}`);
    }
  }
}

export function validateMarkdownPdfProfileShape(profile: Record<string, unknown>): void {
  validateRegisteredObject(profile, "", "profile");
}
