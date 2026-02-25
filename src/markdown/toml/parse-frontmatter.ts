import { ensureArrayContainer, flattenArrayTables } from "./arrays";
import { normalizeKeyPath } from "./keys";
import { stripInlineComment } from "./strings";
import { normalizeValue, toPlainText } from "./values";

export function parseTomlFrontmatter(frontmatter: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  const lines = frontmatter.split("\n");
  let tablePrefix = "";
  let tableTarget: Record<string, unknown> | null = null;
  let tablePrefixInList = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    if (trimmedLine.startsWith("[[")) {
      const match = trimmedLine.match(/^\[\[([^\]]+)]]$/);
      if (!match) {
        return null;
      }
      const normalizedTable = normalizeKeyPath(match[1] ?? "");
      if (!normalizedTable) {
        return null;
      }
      const list = ensureArrayContainer(result, normalizedTable);
      const newEntry: Record<string, unknown> = {};
      list.push(newEntry);
      tableTarget = newEntry;
      tablePrefix = normalizedTable;
      tablePrefixInList = true;
      continue;
    }

    const tableMatch = trimmedLine.match(/^\[([^\]]+)]$/);
    if (tableMatch) {
      const normalizedTable = normalizeKeyPath(tableMatch[1] ?? "");
      if (!normalizedTable) {
        return null;
      }
      tablePrefix = normalizedTable;
      tablePrefixInList = false;
      tableTarget = null;
      continue;
    }

    const lineForParsing = /("""|''')/.test(rawLine) ? rawLine : stripInlineComment(rawLine);
    const separatorIndex = lineForParsing.indexOf("=");
    if (separatorIndex === -1) {
      return null;
    }

    const keyRaw = lineForParsing.slice(0, separatorIndex);
    const key = normalizeKeyPath(keyRaw);
    let valueRaw = lineForParsing.slice(separatorIndex + 1).trim();
    if (!key) {
      return null;
    }

    const tripleDelimiter = valueRaw.startsWith('"""') ? '"""' : valueRaw.startsWith("'''") ? "'''" : null;
    if (tripleDelimiter) {
      const closingIndex = valueRaw.indexOf(tripleDelimiter, tripleDelimiter.length);
      if (closingIndex !== -1) {
        const after = valueRaw.slice(closingIndex + tripleDelimiter.length);
        const strippedAfter = stripInlineComment(after);
        valueRaw = `${valueRaw.slice(0, closingIndex + tripleDelimiter.length)}${strippedAfter}`;
      } else {
        const delimiter = tripleDelimiter;
      let combined = valueRaw;
      let closed = false;
      while (index + 1 < lines.length) {
        index += 1;
        const nextLine = lines[index] ?? "";
        combined += `\n${nextLine}`;
        if (new RegExp(`${delimiter}\\s*$`).test(nextLine)) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        return null;
      }
      valueRaw = combined;
      }
    }

    const normalized = normalizeValue(valueRaw);
    if (normalized === null) {
      return null;
    }

    const fullKey = tablePrefix ? `${tablePrefix}.${key}` : key;
    if (typeof normalized === "object" && !Array.isArray(normalized)) {
      for (const [inlineKey, inlineValue] of Object.entries(normalized)) {
        const entryKey = tablePrefixInList ? `${key}.${inlineKey}` : `${fullKey}.${inlineKey}`;
        if (tablePrefixInList && tableTarget) {
          tableTarget[entryKey] = toPlainText(inlineValue);
        } else {
          result[entryKey] = toPlainText(inlineValue);
        }
      }
      continue;
    }

    if (tablePrefixInList && tableTarget) {
      tableTarget[key] = toPlainText(normalized);
      continue;
    }

    result[fullKey] = toPlainText(normalized);
  }

  flattenArrayTables(result);

  return result;
}
