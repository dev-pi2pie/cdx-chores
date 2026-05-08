import { parseDocument } from "yaml";

import { CliError } from "../../errors";
import { readTextFileRequired } from "../../file-io";
import {
  assertPlainObject,
  inferMarkdownPdfProfileFormat,
  validateMarkdownPdfProfileShape,
} from "./schema";

export async function readMarkdownPdfProfileFile(path: string): Promise<Record<string, unknown>> {
  const format = inferMarkdownPdfProfileFormat(path);
  const raw = await readTextFileRequired(path);
  let parsed: unknown;

  if (format === "json") {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Failed to parse Markdown PDF profile JSON: ${path} (${message})`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  } else {
    const doc = parseDocument(raw, { prettyErrors: false });
    if (doc.errors.length > 0) {
      throw new CliError(`Failed to parse Markdown PDF profile YAML: ${path}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    parsed = doc.toJSON();
  }

  const profile = assertPlainObject(parsed, "Markdown PDF profile");
  validateMarkdownPdfProfileShape(profile);
  return profile;
}
