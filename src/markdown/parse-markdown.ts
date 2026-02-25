import { parseDocument } from "yaml";
import { parseTomlFrontmatter } from "./toml-simple";
import type { FrontmatterType, ParsedMarkdown } from "./types";

const FENCE_TO_TYPE: Record<string, FrontmatterType> = {
  "---": "yaml",
  "+++": "toml",
  ";;;": "json",
};

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n");
}

function stripBom(line: string): string {
  return line.startsWith("\uFEFF") ? line.slice(1) : line;
}

function getFenceType(line: string): FrontmatterType | null {
  const match = line.match(/^[\t ]*(---|\+\+\+|;;;)[\t ]*$/);
  if (!match) {
    return null;
  }
  return FENCE_TO_TYPE[match[1] ?? ""] ?? null;
}

function parseFrontmatter(frontmatter: string, type: FrontmatterType | null): Record<string, unknown> | null {
  if (!type) {
    return null;
  }

  if (type === "json") {
    try {
      return JSON.parse(frontmatter) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (type === "yaml") {
    const doc = parseDocument(frontmatter, { prettyErrors: false });
    if (doc.errors.length > 0) {
      return null;
    }
    const data = doc.toJSON();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    return data as Record<string, unknown>;
  }

  if (type === "toml") {
    return parseTomlFrontmatter(frontmatter);
  }

  return null;
}

function extractJsonBlock(text: string, startIndex: number): { jsonText: string; endIndex: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i] ?? "";

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const jsonText = text.slice(startIndex, i + 1);
        return { jsonText, endIndex: i };
      }
    }
  }

  return null;
}

export function parseMarkdown(input: string): ParsedMarkdown {
  const normalized = normalizeNewlines(input);
  const lines = normalized.split("\n");
  if (lines.length === 0) {
    return { frontmatter: null, content: normalized, data: null, frontmatterType: null };
  }

  lines[0] = stripBom(lines[0] ?? "");
  const normalizedWithoutBom = lines.join("\n");

  const openingType = getFenceType(lines[0] ?? "");
  if (!openingType) {
    const leadingWhitespace = normalizedWithoutBom.match(/^[\t \n]*/)?.[0] ?? "";
    const jsonStart = leadingWhitespace.length;
    if (normalizedWithoutBom[jsonStart] !== "{") {
      return { frontmatter: null, content: normalizedWithoutBom, data: null, frontmatterType: null };
    }

    const jsonBlock = extractJsonBlock(normalizedWithoutBom, jsonStart);
    if (!jsonBlock) {
      return { frontmatter: null, content: normalizedWithoutBom, data: null, frontmatterType: null };
    }

    const frontmatter = jsonBlock.jsonText;
    let content = normalizedWithoutBom.slice(jsonBlock.endIndex + 1);
    if (content.startsWith("\n")) {
      content = content.slice(1);
    }
    const data = parseFrontmatter(frontmatter, "json");
    if (!data) {
      return { frontmatter: null, content: normalizedWithoutBom, data: null, frontmatterType: null };
    }

    return {
      frontmatter,
      content,
      data,
      frontmatterType: "json",
    };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (getFenceType(lines[i] ?? "") === openingType) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { frontmatter: null, content: normalizedWithoutBom, data: null, frontmatterType: null };
  }

  const frontmatter = lines.slice(1, closingIndex).join("\n");
  const content = lines.slice(closingIndex + 1).join("\n");
  const data = parseFrontmatter(frontmatter, openingType);

  return {
    frontmatter,
    content,
    data,
    frontmatterType: openingType,
  };
}
