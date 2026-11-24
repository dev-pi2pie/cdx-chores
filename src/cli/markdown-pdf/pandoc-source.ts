import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { parseMarkdown } from "../../markdown";
import { CliError, toCliError } from "../errors";
import type { execCommand } from "../process";
import {
  shouldSuppressMarkdownPdfMetadataTitle,
  styledTitleHeadings,
  type StyledTitleHeading,
} from "./ast-title";

export type MarkdownPdfAstTitleTemplate = (suppressMetadataTitle: boolean) => string;

interface PandocRenderSource {
  path: string;
  format: "markdown" | "json";
  templateHtml: string;
  readerStderr: string;
  styledTitle?: { headings: StyledTitleHeading[]; inlineMatch: boolean };
}

function stageError(message: string, readerStderr = ""): CliError {
  const earlier = readerStderr.trim();
  return new CliError(
    earlier ? `pandoc Markdown reader diagnostics:\n${earlier}\n${message}` : message,
    {
      code: "PROCESS_FAILED",
      exitCode: 1,
    },
  );
}

export async function runMarkdownPdfPandocStage(
  runner: typeof execCommand,
  stage: "Markdown reader" | "HTML writer",
  args: string[],
  cwd: string,
  readerStderr?: string,
) {
  let result;
  try {
    result = await runner("pandoc", args, { cwd });
  } catch (error) {
    throw stageError(`pandoc ${stage} failed to run: ${toCliError(error).message}`, readerStderr);
  }
  if (!result.ok) {
    throw stageError(
      `pandoc ${stage} failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(),
      readerStderr,
    );
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readAst(path: string, readerStderr: string): Promise<unknown> {
  let document: unknown;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw stageError("pandoc JSON output could not be read as valid JSON.", readerStderr);
  }
  const version = isRecord(document) ? document["pandoc-api-version"] : undefined;
  if (
    !isRecord(document) ||
    !isRecord(document.meta) ||
    !Array.isArray(document.blocks) ||
    !Array.isArray(version) ||
    version.length === 0 ||
    !version.every((part) => Number.isInteger(part) && part >= 0)
  ) {
    throw stageError("pandoc JSON output has an invalid document envelope.", readerStderr);
  }
  return document;
}

export async function resolveMarkdownPdfPandocSource(input: {
  inputPath: string;
  cwd: string;
  tempDir: string;
  templateHtml: string;
  templateForAstTitle?: MarkdownPdfAstTitleTemplate;
  customStyle?: boolean;
  runner: typeof execCommand;
}): Promise<PandocRenderSource> {
  const direct: PandocRenderSource = {
    path: input.inputPath,
    format: "markdown",
    templateHtml: input.templateHtml,
    readerStderr: "",
  };
  if (!input.templateForAstTitle) return direct;

  const markdown = await readFile(input.inputPath).catch((error: unknown) => {
    throw stageError(`pandoc Markdown input could not be read: ${toCliError(error).message}`);
  });
  const text = markdown.toString("utf8");
  const title = parseMarkdown(text).data?.title;
  // Both routes must read the bytes that determined the front-matter title eligibility.
  const sourceDir = join(input.tempDir, "source");
  await mkdir(sourceDir);
  const snapshotPath = join(sourceDir, basename(input.inputPath));
  await writeFile(snapshotPath, markdown);
  if (typeof title !== "string" || !title.trim()) {
    return { ...direct, path: snapshotPath, templateHtml: input.templateForAstTitle(false) };
  }

  const path = join(input.tempDir, "document.json");
  const reader = await runMarkdownPdfPandocStage(
    input.runner,
    "Markdown reader",
    [snapshotPath, "--from", "markdown", "--to", "json", "--output", path],
    input.cwd,
  );
  const document = await readAst(path, reader.stderr);
  const inlineMatch = shouldSuppressMarkdownPdfMetadataTitle(document, title);
  const styled = input.customStyle || /<(?:style|link)\b/iu.test(text);
  const headings = styled ? styledTitleHeadings(document) : [];
  const styledTitle = headings.length ? { headings, inlineMatch } : undefined;
  return {
    path,
    format: "json",
    templateHtml: input.templateForAstTitle(!styledTitle && inlineMatch),
    styledTitle,
    readerStderr: reader.stderr,
  };
}
