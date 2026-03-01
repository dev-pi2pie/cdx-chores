export const RENAME_SERIAL_ORDER_VALUES = [
  "path_asc",
  "path_desc",
  "mtime_asc",
  "mtime_desc",
] as const;

export type RenameSerialOrder = (typeof RENAME_SERIAL_ORDER_VALUES)[number];

export const RENAME_SERIAL_SCOPE_VALUES = ["global", "directory"] as const;

export type RenameSerialScope = (typeof RENAME_SERIAL_SCOPE_VALUES)[number];

export const DEFAULT_RENAME_SERIAL_ORDER: RenameSerialOrder = "path_asc";
export const DEFAULT_RENAME_SERIAL_START = 1;

export const RENAME_TEMPLATE_PRESET_VALUES = [
  "default",
  "timestamp-first",
  "stem-first",
  "custom",
] as const;

export type RenameTemplatePreset = (typeof RENAME_TEMPLATE_PRESET_VALUES)[number];

const RENAME_TEMPLATE_PRESET_PATTERNS: Record<Exclude<RenameTemplatePreset, "custom">, string> = {
  default: "{prefix}-{timestamp}-{stem}",
  "timestamp-first": "{timestamp}-{prefix}-{stem}",
  "stem-first": "{stem}-{timestamp}-{prefix}",
};

interface SerialTokenOptions {
  width?: number;
  start?: number;
  order?: RenameSerialOrder;
}

export interface ParsedSerialToken {
  width?: number;
  start: number;
  order: RenameSerialOrder;
}

function ensureSerialStart(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Serial start must be a non-negative integer.");
  }
  return value;
}

function ensureSerialWidth(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Serial width must be a positive integer.");
  }
  return value;
}

function normalizeSerialTokenInput(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Serial token cannot be empty.");
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function isRenameSerialOrder(value: string): value is RenameSerialOrder {
  return (RENAME_SERIAL_ORDER_VALUES as readonly string[]).includes(value);
}

export function isRenameSerialScope(value: string): value is RenameSerialScope {
  return (RENAME_SERIAL_SCOPE_VALUES as readonly string[]).includes(value);
}

export function parseSerialToken(token: string): ParsedSerialToken {
  const normalized = normalizeSerialTokenInput(token);
  if (normalized === "serial") {
    return {
      start: DEFAULT_RENAME_SERIAL_START,
      order: DEFAULT_RENAME_SERIAL_ORDER,
    };
  }
  if (!normalized.startsWith("serial_")) {
    throw new Error(`Invalid serial token '${token}'. Expected '{serial...}'.`);
  }

  const body = normalized.slice("serial_".length);
  const segments = body.split("_").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    throw new Error(`Invalid serial token '${token}'.`);
  }

  let width: number | undefined;
  let start = DEFAULT_RENAME_SERIAL_START;
  let order: RenameSerialOrder = DEFAULT_RENAME_SERIAL_ORDER;
  let hasStart = false;
  let hasOrder = false;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) {
      continue;
    }

    if (/^#+$/.test(segment)) {
      if (width !== undefined) {
        throw new Error("Serial token cannot contain multiple width markers.");
      }
      width = segment.length;
      continue;
    }

    if (segment === "start") {
      if (hasStart) {
        throw new Error("Serial token cannot contain multiple start markers.");
      }
      const value = segments[index + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error("Serial start marker must use 'start_<non-negative-integer>'.");
      }
      start = ensureSerialStart(Number(value));
      hasStart = true;
      index += 1;
      continue;
    }

    if (segment === "order") {
      if (hasOrder) {
        throw new Error("Serial token cannot contain multiple order markers.");
      }
      const first = segments[index + 1];
      const second = segments[index + 2];
      if (!first || !second) {
        throw new Error(
          "Serial order marker must use one of: order_path_asc, order_path_desc, order_mtime_asc, order_mtime_desc.",
        );
      }
      const value = `${first}_${second}`;
      if (!isRenameSerialOrder(value)) {
        throw new Error(
          "Serial order marker must use one of: path_asc, path_desc, mtime_asc, mtime_desc.",
        );
      }
      order = value;
      hasOrder = true;
      index += 2;
      continue;
    }

    throw new Error(`Unknown serial token parameter '${segment}'.`);
  }

  return { width, start, order };
}

export function serializeSerialToken(
  options: SerialTokenOptions = {},
  config: { includeDefaults?: boolean } = {},
): string {
  const width = options.width !== undefined ? ensureSerialWidth(options.width) : undefined;
  const start = ensureSerialStart(options.start ?? DEFAULT_RENAME_SERIAL_START);
  const order = options.order ?? DEFAULT_RENAME_SERIAL_ORDER;
  const includeDefaults = config.includeDefaults ?? false;

  const parts = ["serial"];

  if (width !== undefined) {
    parts.push("#".repeat(width));
  }
  if (includeDefaults || start !== DEFAULT_RENAME_SERIAL_START) {
    parts.push("start", String(start));
  }
  if (includeDefaults || order !== DEFAULT_RENAME_SERIAL_ORDER) {
    const [orderBase, orderDirection] = order.split("_");
    if (!orderBase || !orderDirection) {
      throw new Error(`Invalid serial order '${order}'.`);
    }
    parts.push("order", orderBase, orderDirection);
  }

  return `{${parts.join("_")}}`;
}

export function getRenamePatternPresetTemplate(
  preset: Exclude<RenameTemplatePreset, "custom">,
): string {
  return RENAME_TEMPLATE_PRESET_PATTERNS[preset];
}

export function resolveRenamePatternTemplate(options: {
  preset: RenameTemplatePreset;
  customTemplate?: string;
}): string {
  if (options.preset === "custom") {
    const customTemplate = (options.customTemplate ?? "").trim();
    if (!customTemplate) {
      throw new Error("Custom template cannot be empty.");
    }
    return customTemplate;
  }

  return getRenamePatternPresetTemplate(options.preset);
}

export function normalizeSerialPlaceholderInTemplate(options: {
  template: string;
  serial: SerialTokenOptions;
  includeDefaults?: boolean;
}): string {
  const token = serializeSerialToken(options.serial, {
    includeDefaults: options.includeDefaults ?? false,
  });
  return options.template.replace(/\{serial(?:_[^{}]+)?\}/g, token);
}

export function templateContainsSerialPlaceholder(template: string): boolean {
  return /\{serial(?:_[^{}]+)?\}/.test(template);
}

export function templateContainsPrefixPlaceholder(template: string): boolean {
  return /\{prefix\}/.test(template);
}

export type TimestampTimezone = "local" | "utc";

export const TIMESTAMP_TIMEZONE_VALUES = ["local", "utc"] as const;

const LEGACY_TIMESTAMP_PLACEHOLDER_PATTERN = /\{\s*timestamp\s*\}/;
const LEGACY_TIMESTAMP_PLACEHOLDER_GLOBAL_PATTERN = /\{\s*timestamp\s*\}/g;
const EXPLICIT_TIMESTAMP_PLACEHOLDER_PATTERN = /\{\s*timestamp_(local|utc)\s*\}/;

/**
 * Returns true when a template contains the legacy `{timestamp}` placeholder
 * but does NOT contain an explicit `{timestamp_local}` or `{timestamp_utc}`.
 */
export function templateContainsLegacyTimestamp(template: string): boolean {
  return (
    LEGACY_TIMESTAMP_PLACEHOLDER_PATTERN.test(template) &&
    !EXPLICIT_TIMESTAMP_PLACEHOLDER_PATTERN.test(template)
  );
}

/**
 * Returns true when a template already uses `{timestamp_local}` or `{timestamp_utc}`.
 */
export function templateContainsExplicitTimestamp(template: string): boolean {
  return EXPLICIT_TIMESTAMP_PLACEHOLDER_PATTERN.test(template);
}

/**
 * Rewrite all `{timestamp}` placeholders in a template to the explicit form
 * based on the chosen timezone. No-op when the template does not contain `{timestamp}`.
 */
export function rewriteTimestampPlaceholder(template: string, timezone: TimestampTimezone): string {
  const target = timezone === "local" ? "{timestamp_local}" : "{timestamp_utc}";
  return template.replace(LEGACY_TIMESTAMP_PLACEHOLDER_GLOBAL_PATTERN, target);
}

/**
 * Pure decision: should the interactive flow present a timezone-selection
 * prompt for a given rename pattern?
 *
 * Returns `true` only when the pattern contains a bare `{timestamp}` without
 * any explicit `{timestamp_local}` or `{timestamp_utc}` variant.
 */
export function shouldPromptTimestampTimezone(pattern: string): boolean {
  return templateContainsLegacyTimestamp(pattern);
}

/**
 * Apply the result of the interactive timezone prompt to a rename pattern.
 *
 * When `selectedTimezone` is defined the legacy `{timestamp}` tokens are
 * rewritten to the explicit form. Otherwise the pattern is returned as-is.
 */
export function resolveTimestampPatternForInteractive(
  pattern: string,
  selectedTimezone: TimestampTimezone | undefined,
): string {
  if (selectedTimezone === undefined || !templateContainsLegacyTimestamp(pattern)) {
    return pattern;
  }
  return rewriteTimestampPlaceholder(pattern, selectedTimezone);
}
