import { parseDocument } from "yaml";

import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import {
  assertPlainObject,
  inferMarkdownPdfProfileFormat,
  validateMarkdownPdfProfileShape,
} from "./schema";

export type MarkdownPdfProfileParseResult =
  | { ok: true; value: unknown }
  | { error: CliError; ok: false };

export async function parseMarkdownPdfProfileFile(
  path: string,
): Promise<MarkdownPdfProfileParseResult> {
  const format = inferMarkdownPdfProfileFormat(path);
  const raw = await readTextFileRequired(path);

  if (format === "json") {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: new CliError(`Failed to parse Markdown PDF profile JSON: ${path} (${message})`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        }),
        ok: false,
      };
    }
  }

  const doc = parseDocument(raw, { prettyErrors: false });
  if (doc.errors.length > 0) {
    return {
      error: new CliError(`Failed to parse Markdown PDF profile YAML: ${path}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      }),
      ok: false,
    };
  }
  return { ok: true, value: doc.toJSON() };
}

export async function readMarkdownPdfProfileFile(path: string): Promise<Record<string, unknown>> {
  const parsed = await parseMarkdownPdfProfileFile(path);
  if (!parsed.ok) {
    throw parsed.error;
  }

  const profile = assertPlainObject(parsed.value, "Markdown PDF profile");
  validateMarkdownPdfProfileShape(profile);
  return profile;
}
