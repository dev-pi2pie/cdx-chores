import { normalizeKeyPath } from "./keys";
import { parseStringLiteral } from "./strings";
import type { TomlValue } from "./types";

function parsePrimitive(raw: string): string | number | boolean | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const stringLiteral = parseStringLiteral(value);
  if (stringLiteral !== null) {
    return stringLiteral;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    return Number(value);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }

  return value;
}

function parseArray(raw: string): Array<string | number | boolean> | null {
  const value = raw.trim();
  if (!value.startsWith("[") || !value.endsWith("]")) {
    return null;
  }

  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const items: Array<string | number | boolean> = [];
  let current = "";
  let inString: "single" | "double" | null = null;
  let escaped = false;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i] ?? "";

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\" && inString === "double") {
        escaped = true;
        continue;
      }

      if (inString === "double" && char === "\"") {
        inString = null;
      } else if (inString === "single" && char === "'") {
        inString = null;
      }
      continue;
    }

    if (char === "\"") {
      inString = "double";
      current += char;
      continue;
    }

    if (char === "'") {
      inString = "single";
      current += char;
      continue;
    }

    if (char === ",") {
      const item = parsePrimitive(current);
      if (item === null) {
        return null;
      }
      items.push(item);
      current = "";
      continue;
    }

    current += char;
  }

  const finalItem = parsePrimitive(current);
  if (finalItem === null) {
    return null;
  }
  items.push(finalItem);

  return items;
}

function parseInlineTable(raw: string): Record<string, TomlValue> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return {};
  }

  const pairs: string[] = [];
  let current = "";
  let inString: "single" | "double" | null = null;
  let escaped = false;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i] ?? "";

    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\" && inString === "double") {
        escaped = true;
        continue;
      }

      if (inString === "double" && char === "\"") {
        inString = null;
      } else if (inString === "single" && char === "'") {
        inString = null;
      }
      continue;
    }

    if (char === "\"") {
      inString = "double";
      current += char;
      continue;
    }

    if (char === "'") {
      inString = "single";
      current += char;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === "]") {
      if (bracketDepth > 0) {
        bracketDepth -= 1;
      }
      current += char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      current += char;
      continue;
    }

    if (char === "}") {
      if (braceDepth > 0) {
        braceDepth -= 1;
      }
      current += char;
      continue;
    }

    if (char === "," && bracketDepth === 0 && braceDepth === 0) {
      pairs.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    pairs.push(current);
  }

  const output: Record<string, TomlValue> = {};
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return null;
    }
    const key = normalizeKeyPath(pair.slice(0, separatorIndex));
    if (!key) {
      return null;
    }
    const valueRaw = pair.slice(separatorIndex + 1).trim();
    if (!valueRaw) {
      return null;
    }
    if (valueRaw.startsWith("{")) {
      return null;
    }
    const normalized = normalizeValue(valueRaw);
    if (normalized === null) {
      return null;
    }
    if (typeof normalized === "object" && !Array.isArray(normalized)) {
      return null;
    }
    output[key] = normalized;
  }

  return output;
}

export function normalizeValue(value: string): TomlValue | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineTable(trimmed);
  }

  const array = parseArray(trimmed);
  if (array) {
    return array;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return null;
  }

  return parsePrimitive(trimmed);
}

export function toPlainText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }
  return String(value);
}
