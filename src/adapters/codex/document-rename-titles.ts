import { access, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

import * as mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseDocument as parseYamlDocument } from "yaml";

import { parseMarkdown } from "../../markdown";
import { parseTomlFrontmatter } from "../../markdown/toml-simple";
import {
  CODEX_FILENAME_TITLE_OUTPUT_SCHEMA,
  chunkItems,
  executeBatchesWithRetries,
  parseFilenameTitleSuggestions,
  startCodexReadOnlyThread,
  summarizeBatchErrors,
} from "./shared";

export interface CodexDocumentRenameSuggestion {
  path: string;
  title: string;
}

export interface CodexDocumentRenameReason {
  path: string;
  reason: string;
}

export interface CodexDocumentRenameResult {
  suggestions: CodexDocumentRenameSuggestion[];
  reasons?: CodexDocumentRenameReason[];
  errorMessage?: string;
}

interface SuggestDocumentTitlesOptions {
  documentPaths: string[];
  workingDirectory: string;
  timeoutMs?: number;
  retries?: number;
  batchSize?: number;
}

interface DocumentTitleEvidence {
  filename: string;
  extension: string;
  detectedType: "markdown" | "text" | "json" | "yaml" | "toml" | "html" | "xml" | "pdf" | "docx";
  titleCandidates: string[];
  authorCandidates?: string[];
  headings?: string[];
  tocCandidates?: string[];
  leadText?: string;
  keySummary?: string[];
  metadata?: Record<string, unknown>;
  warnings?: string[];
}

const DOC_MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const DOC_PLAIN_TEXT_EXTENSIONS = new Set([".txt"]);
const DOC_JSON_EXTENSIONS = new Set([".json"]);
const DOC_YAML_EXTENSIONS = new Set([".yaml", ".yml"]);
const DOC_TOML_EXTENSIONS = new Set([".toml"]);
const DOC_HTML_EXTENSIONS = new Set([".html", ".htm"]);
const DOC_XML_EXTENSIONS = new Set([".xml"]);
const DOC_PDF_EXTENSIONS = new Set([".pdf"]);
const DOC_DOCX_EXTENSIONS = new Set([".docx"]);
const MAX_TITLE_CANDIDATES = 4;
const MAX_HEADINGS = 8;
const MAX_LEAD_TEXT_CHARS = 800;
const MAX_KEY_SUMMARY = 12;
let pdfStandardFontDataUrlPromise: Promise<string | undefined> | undefined;

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstParagraph(lines: string[]): string | undefined {
  const paragraphLines: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (paragraphLines.length > 0) {
        break;
      }
      continue;
    }
    paragraphLines.push(line);
    if (toSingleLine(paragraphLines.join(" ")).length >= MAX_LEAD_TEXT_CHARS) {
      break;
    }
  }

  if (paragraphLines.length === 0) {
    return undefined;
  }

  return toSingleLine(paragraphLines.join(" ")).slice(0, MAX_LEAD_TEXT_CHARS);
}

function getStringCandidate(data: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!data) {
    return undefined;
  }
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string") {
      const normalized = toSingleLine(value);
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
}

function getNestedStringCandidate(
  data: Record<string, unknown> | null,
  paths: string[][],
): string | undefined {
  if (!data) {
    return undefined;
  }

  for (const path of paths) {
    let current: unknown = data;
    let ok = true;
    for (const segment of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        ok = false;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (!ok || typeof current !== "string") {
      continue;
    }
    const normalized = toSingleLine(current);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function collectKeySummary(data: Record<string, unknown> | null): string[] | undefined {
  if (!data) {
    return undefined;
  }

  const keys = Object.keys(data)
    .map((key) => key.trim())
    .filter(Boolean)
    .slice(0, MAX_KEY_SUMMARY);

  return keys.length > 0 ? keys : undefined;
}

async function resolvePdfStandardFontDataUrl(): Promise<string | undefined> {
  pdfStandardFontDataUrlPromise ??= (async () => {
    const candidates = [
      new URL("../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
      new URL("../../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
    ];

    for (const candidate of candidates) {
      try {
        await access(fileURLToPath(candidate));
        return candidate.href;
      } catch {
        // try next
      }
    }

    return undefined;
  })();

  return pdfStandardFontDataUrlPromise;
}

function buildStructuredLeadText(data: Record<string, unknown> | null): string | undefined {
  if (!data) {
    return undefined;
  }
  const candidates: string[] = [];
  for (const key of ["description", "summary", "subtitle"]) {
    const value = data[key];
    if (typeof value === "string") {
      const normalized = toSingleLine(value);
      if (normalized) {
        candidates.push(normalized);
      }
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  return toSingleLine(candidates.join(" ")).slice(0, MAX_LEAD_TEXT_CHARS);
}

function extractStructuredObjectEvidence(options: {
  path: string;
  data: Record<string, unknown> | null;
  detectedType: DocumentTitleEvidence["detectedType"];
}): DocumentTitleEvidence | { reason: string } {
  const { path, data, detectedType } = options;
  if (!data) {
    return { reason: "doc_no_text" };
  }

  const titleCandidates = [
    getStringCandidate(data, ["title", "name", "subject"]),
    getNestedStringCandidate(data, [
      ["metadata", "title"],
      ["meta", "title"],
      ["package", "name"],
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .map(toSingleLine);

  const authorCandidate = [
    getStringCandidate(data, ["author", "creator", "owner"]),
    getNestedStringCandidate(data, [
      ["metadata", "author"],
      ["meta", "author"],
      ["package", "author"],
    ]),
  ].find((value): value is string => Boolean(value));

  const leadText = buildStructuredLeadText(data);
  const keySummary = collectKeySummary(data);
  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);

  if (dedupedTitles.length === 0 && !leadText && !(keySummary && keySummary.length > 0)) {
    return { reason: "doc_no_title_signal" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType,
    titleCandidates: dedupedTitles,
    authorCandidates: authorCandidate ? [authorCandidate] : undefined,
    leadText,
    keySummary,
  };
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractHtmlTextLines(html: string): string[] {
  return stripHtmlTags(html)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => toSingleLine(line))
    .filter(Boolean);
}

function extractHtmlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  const titleCandidates: string[] = [];
  const headings: string[] = [];
  const warnings: string[] = [];

  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = toSingleLine(stripHtmlTags(titleMatch[1]));
    if (title) {
      titleCandidates.push(title);
    }
  }

  const authorMetaMatch =
    content.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
    content.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["'][^>]*>/i);
  const author = authorMetaMatch?.[1] ? toSingleLine(authorMetaMatch[1]) : undefined;

  for (const match of content.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const heading = toSingleLine(stripHtmlTags(match[2] ?? ""));
    if (!heading) {
      continue;
    }
    headings.push(heading);
    if ((match[1] ?? "") === "1") {
      titleCandidates.push(heading);
    }
  }

  const textLines = extractHtmlTextLines(content);
  const leadText = firstParagraph(textLines);
  if (!leadText) {
    warnings.push("no_lead_text");
  }

  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
  const dedupedHeadings = [...new Set(headings)].slice(0, MAX_HEADINGS);

  if (dedupedTitles.length === 0 && !leadText && dedupedHeadings.length === 0) {
    return { reason: content.trim().length > 0 ? "doc_no_title_signal" : "doc_no_text" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "html",
    titleCandidates: dedupedTitles,
    authorCandidates: author ? [author] : undefined,
    headings: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
    leadText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function extractXmlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  const titleCandidates: string[] = [];
  const warnings: string[] = [];

  const tagCandidates = ["title", "name", "subject"];
  for (const tag of tagCandidates) {
    const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!match?.[1]) {
      continue;
    }
    const text = toSingleLine(stripHtmlTags(match[1]));
    if (text) {
      titleCandidates.push(text);
    }
  }

  const textLines = extractHtmlTextLines(content);
  const leadText = firstParagraph(textLines);
  if (!leadText) {
    warnings.push("no_lead_text");
  }

  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
  if (dedupedTitles.length === 0 && !leadText) {
    return { reason: content.trim().length > 0 ? "doc_no_title_signal" : "doc_no_text" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "xml",
    titleCandidates: dedupedTitles,
    leadText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function extractPdfTitleAndSignals(options: {
  path: string;
  pageCount: number;
  metadataInfo?: Record<string, unknown>;
  outlineTitles: string[];
  firstPageText: string;
  warnings: string[];
}): DocumentTitleEvidence | { reason: string } {
  const metadataInfo = options.metadataInfo;
  const metadataTitle =
    typeof metadataInfo?.Title === "string" ? toSingleLine(metadataInfo.Title) : undefined;
  const metadataAuthor =
    typeof metadataInfo?.Author === "string" ? toSingleLine(metadataInfo.Author) : undefined;

  const sentenceTitle =
    options.firstPageText
      .split(/(?<=[.!?])\s+/)
      .map((part) => toSingleLine(part))
      .find(Boolean) ?? undefined;

  const titleCandidates = [metadataTitle, options.outlineTitles[0], sentenceTitle].filter(
    (value): value is string => Boolean(value),
  );
  const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
  const dedupedOutline = [...new Set(options.outlineTitles)].slice(0, MAX_HEADINGS);
  const leadText = options.firstPageText ? options.firstPageText.slice(0, MAX_LEAD_TEXT_CHARS) : undefined;

  if (dedupedTitles.length === 0 && !metadataAuthor && !leadText && dedupedOutline.length === 0) {
    return { reason: options.firstPageText ? "pdf_no_title_signal" : "pdf_no_text" };
  }

  return {
    filename: basename(options.path),
    extension: extname(options.path).toLowerCase(),
    detectedType: "pdf",
    titleCandidates: dedupedTitles,
    authorCandidates: metadataAuthor ? [metadataAuthor] : undefined,
    headings: dedupedOutline.length > 0 ? dedupedOutline : undefined,
    tocCandidates: dedupedOutline.length > 0 ? dedupedOutline : undefined,
    leadText,
    metadata: {
      pageCount: options.pageCount,
      pdfTitle: metadataTitle,
      pdfAuthor: metadataAuthor,
      creator: typeof metadataInfo?.Creator === "string" ? metadataInfo.Creator : undefined,
      producer: typeof metadataInfo?.Producer === "string" ? metadataInfo.Producer : undefined,
    },
    warnings: options.warnings.length > 0 ? options.warnings : undefined,
  };
}

async function extractPdfEvidence(path: string): Promise<DocumentTitleEvidence | { reason: string }> {
  let pdfDocument: any;
  try {
    const fileBytes = await readFile(path);
    const standardFontDataUrl = await resolvePdfStandardFontDataUrl();
    const loadingTask = (pdfjs as any).getDocument({
      data: new Uint8Array(fileBytes),
      worker: null,
      useWorkerFetch: false,
      standardFontDataUrl,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      verbosity: (pdfjs as any).VerbosityLevel?.ERRORS ?? 0,
    });
    pdfDocument = await loadingTask.promise;
    const pageCount = Number(pdfDocument?.numPages ?? 0);
    const warnings: string[] = [];

    let metadataInfo: Record<string, unknown> | undefined;
    try {
      const metadata = await pdfDocument.getMetadata();
      metadataInfo = (metadata?.info ?? undefined) as Record<string, unknown> | undefined;
    } catch {
      warnings.push("pdf_metadata_unavailable");
    }

    let outlineTitles: string[] = [];
    try {
      const outline = (await pdfDocument.getOutline()) as Array<{ title?: string }> | null;
      outlineTitles =
        outline
          ?.map((item) => toSingleLine(item.title ?? ""))
          .filter(Boolean)
          .slice(0, 20) ?? [];
      if (outlineTitles.length === 0) {
        warnings.push("pdf_outline_unavailable");
      }
    } catch {
      warnings.push("pdf_outline_unavailable");
    }

    let firstPageText = "";
    try {
      if (pageCount >= 1) {
        const page = await pdfDocument.getPage(1);
        const textContent = await page.getTextContent();
        const textItems = (textContent.items ?? []) as Array<{ str?: string }>;
        firstPageText = toSingleLine(
          textItems
            .map((item) => item.str ?? "")
            .join(" ")
            .trim(),
        );
      }
      if (!firstPageText) {
        warnings.push("pdf_no_page1_text");
      }
    } catch {
      warnings.push("pdf_no_page1_text");
    }

    return extractPdfTitleAndSignals({
      path,
      pageCount,
      metadataInfo,
      outlineTitles,
      firstPageText,
      warnings,
    });
  } catch {
    return { reason: "pdf_extract_error" };
  } finally {
    try {
      await pdfDocument?.destroy?.();
    } catch {
      // ignore cleanup issues
    }
  }
}

async function extractDocxEvidence(path: string): Promise<DocumentTitleEvidence | { reason: string }> {
  try {
    const buffer = await readFile(path);
    const [htmlResult, rawTextResult] = await Promise.all([
      mammoth.convertToHtml({ buffer }),
      mammoth.extractRawText({ buffer }),
    ]);

    const html = htmlResult.value ?? "";
    const rawText = rawTextResult.value ?? "";

    const titleCandidates: string[] = [];
    const headings: string[] = [];
    const warnings: string[] = ["docx_metadata_unavailable"];

    for (const match of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const heading = toSingleLine(stripHtmlTags(match[2] ?? ""));
      if (!heading) {
        continue;
      }
      headings.push(heading);
      if ((match[1] ?? "") === "1") {
        titleCandidates.push(heading);
      }
    }

    const rawLines = rawText
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => toSingleLine(line))
      .filter(Boolean);
    if (rawLines.length > 0) {
      titleCandidates.push(rawLines[0]!);
    }

    const leadText = firstParagraph(rawLines);
    if (!leadText) {
      warnings.push("no_lead_text");
    }

    const dedupedTitles = [...new Set(titleCandidates)].slice(0, MAX_TITLE_CANDIDATES);
    const dedupedHeadings = [...new Set(headings)].slice(0, MAX_HEADINGS);

    if (dedupedTitles.length === 0 && !leadText && dedupedHeadings.length === 0) {
      const hasAnyText = html.trim().length > 0 || rawText.trim().length > 0;
      return { reason: hasAnyText ? "docx_no_title_signal" : "docx_extract_error" };
    }

    return {
      filename: basename(path),
      extension: extname(path).toLowerCase(),
      detectedType: "docx",
      titleCandidates: dedupedTitles,
      headings: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
      tocCandidates: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
      leadText,
      metadata: {
        extractor: "mammoth",
      },
      warnings,
    };
  } catch {
    return { reason: "docx_extract_error" };
  }
}

function extractMarkdownEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  const parsed = parseMarkdown(content);
  const titleCandidates: string[] = [];
  const headings: string[] = [];
  const warnings: string[] = [];

  const frontmatterTitle = getStringCandidate(parsed.data, ["title", "name"]);
  if (frontmatterTitle) {
    titleCandidates.push(frontmatterTitle);
  }
  const frontmatterAuthor = getStringCandidate(parsed.data, ["author", "creator"]);

  const contentLines = parsed.content.split(/\r?\n/);
  const nonHeadingLines: string[] = [];
  for (const rawLine of contentLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      nonHeadingLines.push("");
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingText = toSingleLine(headingMatch[1] ?? "");
      if (headingText) {
        headings.push(headingText);
        if (headingMatch[0].startsWith("# ")) {
          titleCandidates.push(headingText);
        }
      }
      continue;
    }

    nonHeadingLines.push(trimmed);
  }

  const leadText = firstParagraph(nonHeadingLines);
  if (!leadText) {
    warnings.push("no_lead_text");
  }

  const dedupedTitles = [...new Set(titleCandidates.map(toSingleLine).filter(Boolean))].slice(
    0,
    MAX_TITLE_CANDIDATES,
  );
  const dedupedHeadings = [...new Set(headings)].slice(0, MAX_HEADINGS);

  if (dedupedTitles.length === 0 && !leadText && dedupedHeadings.length === 0) {
    const hasAnyText = content.trim().length > 0;
    return { reason: hasAnyText ? "doc_no_title_signal" : "doc_no_text" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "markdown",
    titleCandidates: dedupedTitles,
    authorCandidates: frontmatterAuthor ? [frontmatterAuthor] : undefined,
    headings: dedupedHeadings.length > 0 ? dedupedHeadings : undefined,
    leadText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function extractPlainTextEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  const lines = content.split(/\r?\n/);
  const nonEmpty = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (nonEmpty.length === 0) {
    return { reason: "doc_no_text" };
  }

  const titleCandidates = [toSingleLine(nonEmpty[0] ?? "")].filter(Boolean).slice(0, MAX_TITLE_CANDIDATES);
  const leadText = firstParagraph(lines.map((line) => line.trim()));
  if (titleCandidates.length === 0 && !leadText) {
    return { reason: "doc_no_title_signal" };
  }

  return {
    filename: basename(path),
    extension: extname(path).toLowerCase(),
    detectedType: "text",
    titleCandidates,
    leadText,
  };
}

function extractJsonEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { reason: "doc_no_title_signal" };
    }
    return extractStructuredObjectEvidence({
      path,
      data: parsed as Record<string, unknown>,
      detectedType: "json",
    });
  } catch {
    return { reason: "doc_extract_error" };
  }
}

function extractYamlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  try {
    const doc = parseYamlDocument(content, { prettyErrors: false });
    if (doc.errors.length > 0) {
      return { reason: "doc_extract_error" };
    }
    const parsed = doc.toJSON();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { reason: "doc_no_title_signal" };
    }
    return extractStructuredObjectEvidence({
      path,
      data: parsed as Record<string, unknown>,
      detectedType: "yaml",
    });
  } catch {
    return { reason: "doc_extract_error" };
  }
}

function extractTomlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
  try {
    const parsed = parseTomlFrontmatter(content);
    if (!parsed) {
      return { reason: "doc_extract_error" };
    }
    return extractStructuredObjectEvidence({
      path,
      data: parsed,
      detectedType: "toml",
    });
  } catch {
    return { reason: "doc_extract_error" };
  }
}

async function extractEvidenceForPath(
  path: string,
): Promise<{ evidence?: DocumentTitleEvidence; reason?: string }> {
  const ext = extname(path).toLowerCase();

  if (DOC_PDF_EXTENSIONS.has(ext)) {
    const extracted = await extractPdfEvidence(path);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_DOCX_EXTENSIONS.has(ext)) {
    const extracted = await extractDocxEvidence(path);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch {
    return { reason: "doc_extract_error" };
  }

  if (DOC_MARKDOWN_EXTENSIONS.has(ext)) {
    const extracted = extractMarkdownEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_PLAIN_TEXT_EXTENSIONS.has(ext)) {
    const extracted = extractPlainTextEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_JSON_EXTENSIONS.has(ext)) {
    const extracted = extractJsonEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_YAML_EXTENSIONS.has(ext)) {
    const extracted = extractYamlEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_TOML_EXTENSIONS.has(ext)) {
    const extracted = extractTomlEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_HTML_EXTENSIONS.has(ext)) {
    const extracted = extractHtmlEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  if (DOC_XML_EXTENSIONS.has(ext)) {
    const extracted = extractXmlEvidence(path, content);
    if ("reason" in extracted) {
      return { reason: extracted.reason };
    }
    return { evidence: extracted };
  }

  return { reason: "doc_unsupported_type" };
}

export async function __testOnlyExtractDocumentTitleEvidenceForPath(
  path: string,
): Promise<{ evidence?: DocumentTitleEvidence; reason?: string }> {
  return extractEvidenceForPath(path);
}

function buildPrompt(evidences: DocumentTitleEvidence[]): string {
  return [
    "Generate concise semantic filename titles for these document files from extracted text evidence.",
    "Return JSON only following the provided schema.",
    "Rules:",
    "- One suggestion per listed filename when there is enough signal.",
    "- `title` should be 2-6 words.",
    "- No file extensions.",
    "- No punctuation except spaces and hyphens.",
    "- Prefer document topic/title over generic words like note/file/document.",
    "- If evidence is weak, use a cautious generic title based on available text only.",
    "",
    "Document evidence JSON:",
    JSON.stringify(evidences, null, 2),
  ].join("\n");
}

async function suggestSingleBatch(options: {
  evidences: Array<{ path: string; evidence: DocumentTitleEvidence }>;
  workingDirectory: string;
  timeoutMs?: number;
}): Promise<CodexDocumentRenameResult> {
  if (options.evidences.length === 0) {
    return { suggestions: [] };
  }

  const thread = startCodexReadOnlyThread(options.workingDirectory);

  const turn = await thread.run(
    [{ type: "text", text: buildPrompt(options.evidences.map((item) => item.evidence)) }],
    {
      outputSchema: CODEX_FILENAME_TITLE_OUTPUT_SCHEMA,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    },
  );

  const suggestionsByFilename = parseFilenameTitleSuggestions(turn.finalResponse);

  const suggestions: CodexDocumentRenameSuggestion[] = [];
  for (const item of options.evidences) {
    const title = suggestionsByFilename.get(item.evidence.filename);
    if (!title) {
      continue;
    }
    suggestions.push({ path: item.path, title });
  }

  return { suggestions };
}

export async function suggestDocumentRenameTitlesWithCodex(
  options: SuggestDocumentTitlesOptions,
): Promise<CodexDocumentRenameResult> {
  if (options.documentPaths.length === 0) {
    return { suggestions: [] };
  }

  const reasons: CodexDocumentRenameReason[] = [];
  const evidenceItems: Array<{ path: string; evidence: DocumentTitleEvidence }> = [];

  for (const path of options.documentPaths) {
    const extracted = await extractEvidenceForPath(path);
    if (extracted.reason) {
      reasons.push({ path, reason: extracted.reason });
      continue;
    }
    if (extracted.evidence) {
      evidenceItems.push({ path, evidence: extracted.evidence });
    }
  }

  if (evidenceItems.length === 0) {
    return { suggestions: [], reasons };
  }

  try {
    const batchSize = Math.max(1, Math.trunc(options.batchSize ?? evidenceItems.length));
    const retries = Math.max(0, Math.trunc(options.retries ?? 0));
    const batches = chunkItems(evidenceItems, batchSize);
    const { suggestions, batchErrors } = await executeBatchesWithRetries({
      batches,
      retries,
      runBatch: async (batch) =>
        suggestSingleBatch({
          evidences: batch,
          workingDirectory: options.workingDirectory,
          timeoutMs: options.timeoutMs,
        }),
    });

    const errorSummary = summarizeBatchErrors(batchErrors, suggestions.length > 0);
    if (!errorSummary) {
      return { suggestions, reasons };
    }

    return { suggestions, reasons, errorMessage: errorSummary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { suggestions: [], reasons, errorMessage: message };
  }
}
