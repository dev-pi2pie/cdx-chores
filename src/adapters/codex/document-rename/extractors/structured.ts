import { parseDocument as parseYamlDocument } from "yaml";

import { parseTomlFrontmatter } from "../../../../markdown/toml-simple";
import type { DocumentTitleEvidence } from "../types";
import { extractStructuredObjectEvidence } from "./shared";

export function extractJsonEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
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

export function extractYamlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
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

export function extractTomlEvidence(path: string, content: string): DocumentTitleEvidence | { reason: string } {
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
