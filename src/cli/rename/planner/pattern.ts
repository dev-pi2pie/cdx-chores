import {
  type RenameSerialOrder,
  type RenameSerialScope,
  normalizeSerialPlaceholderInTemplate,
  parseSerialToken,
} from "../../rename-template";
import { CliError } from "../../errors";
import { slugifyName } from "../../../utils/slug";
import {
  RENAME_TEMPLATE_ALLOWED_PLACEHOLDERS,
  RENAME_TEMPLATE_SIMPLE_TOKENS,
  RENAME_TEMPLATE_TOKEN_PATTERN,
} from "./tokens";

const RENAME_TEMPLATE_DEFAULT = "{prefix}-{timestamp}-{stem}";

export interface RenamePatternOptions {
  pattern?: string;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope?: RenameSerialScope;
  recursive?: boolean;
}

export interface PreparedRenamePattern {
  template: string;
  usesUid: boolean;
  serial?: {
    order: RenameSerialOrder;
    start: number;
    width?: number;
    scope: RenameSerialScope;
  };
}

export function normalizePrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? "").trim();
  if (!trimmed) {
    return "";
  }

  return slugifyName(trimmed);
}

function ensureValidTemplateBraces(template: string): void {
  let inToken = false;
  for (const char of template) {
    if (char === "{") {
      if (inToken) {
        throw new CliError("Invalid --pattern: nested '{' is not supported.", {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      inToken = true;
      continue;
    }

    if (char === "}") {
      if (!inToken) {
        throw new CliError("Invalid --pattern: unmatched '}' found.", {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      inToken = false;
    }
  }

  if (inToken) {
    throw new CliError("Invalid --pattern: missing closing '}'.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

function parseTemplateTokens(template: string): string[] {
  const tokens: string[] = [];
  for (const match of template.matchAll(RENAME_TEMPLATE_TOKEN_PATTERN)) {
    const token = (match[1] ?? "").trim();
    if (!token) {
      throw new CliError("Invalid --pattern: empty placeholder '{}'.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    tokens.push(token);
  }

  return tokens;
}

export function getPreparedRenamePattern(options: RenamePatternOptions): PreparedRenamePattern {
  const template = (options.pattern ?? RENAME_TEMPLATE_DEFAULT).trim();
  if (!template) {
    throw new CliError("Invalid --pattern: template cannot be empty.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  ensureValidTemplateBraces(template);
  const tokens = parseTemplateTokens(template);
  const serialTokens = tokens.filter((token) => token === "serial" || token.startsWith("serial_"));
  if (serialTokens.length > 1) {
    throw new CliError(
      "Invalid --pattern: only one {serial...} placeholder is supported per template.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  let serial: PreparedRenamePattern["serial"];
  let normalizedTemplate = template;

  if (serialTokens.length > 0) {
    let parsed;
    try {
      parsed = parseSerialToken(serialTokens[0] ?? "serial");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CliError(`Invalid --pattern serial token: ${message}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const start = options.serialStart ?? parsed.start;
    if (!Number.isInteger(start) || start < 0) {
      throw new CliError("Invalid --serial-start: must be a non-negative integer.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const width = options.serialWidth ?? parsed.width;
    if (width !== undefined && (!Number.isInteger(width) || width <= 0)) {
      throw new CliError("Invalid --serial-width: must be a positive integer.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const order = options.serialOrder ?? parsed.order;
    const scope = options.serialScope ?? "global";
    serial = { order, start, width, scope };
    normalizedTemplate = normalizeSerialPlaceholderInTemplate({
      template,
      serial: {
        order: serial.order,
        start: serial.start,
        width: serial.width,
      },
      includeDefaults: true,
    });
  }

  const normalizedTokens = parseTemplateTokens(normalizedTemplate);
  for (const token of normalizedTokens) {
    if (RENAME_TEMPLATE_SIMPLE_TOKENS.has(token)) {
      continue;
    }

    if (token === "serial" || token.startsWith("serial_")) {
      try {
        parseSerialToken(token);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError(`Invalid --pattern serial token: ${message}`, {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }
      continue;
    }

    throw new CliError(
      `Invalid --pattern placeholder: {${token}}. Allowed placeholders: ${RENAME_TEMPLATE_ALLOWED_PLACEHOLDERS}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    template: normalizedTemplate,
    usesUid: normalizedTokens.includes("uid"),
    serial,
  };
}
