export function stripInlineComment(line: string): string {
  let inString: "single" | "double" | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? "";

    if (inString) {
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
        continue;
      }

      if (inString === "single" && char === "'") {
        inString = null;
        continue;
      }

      continue;
    }

    if (char === "\"") {
      inString = "double";
      continue;
    }

    if (char === "'") {
      inString = "single";
      continue;
    }

    if (char === "#") {
      return line.slice(0, i).trimEnd();
    }
  }

  return line;
}

function unescapeBasic(input: string): string {
  return input
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

export function parseStringLiteral(value: string): string | null {
  if (value.startsWith('"""') && value.endsWith('"""')) {
    const inner = value.slice(3, -3);
    return unescapeBasic(inner);
  }

  if (value.startsWith("'''") && value.endsWith("'''")) {
    return value.slice(3, -3);
  }

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return unescapeBasic(value.slice(1, -1));
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return null;
}
