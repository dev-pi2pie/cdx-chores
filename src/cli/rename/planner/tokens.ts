import {
  formatLocalFileDateTime,
  formatLocalFileDateTime12Hour,
  formatLocalFileDateTimeISO,
  formatUtcFileDateTime,
  formatUtcFileDateTime12Hour,
  formatUtcFileDateTimeISO,
} from "../../../utils/datetime";

export const RENAME_TEMPLATE_TOKEN_PATTERN = /\{([^{}]+)\}/g;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type RenameTemplateTokenContext = {
  prefix: string;
  stem: string;
  mtimeDate: Date;
  serialText?: string;
  uidText?: string;
};

const RENAME_TEMPLATE_TOKEN_RENDERERS = {
  prefix: (options: RenameTemplateTokenContext) => options.prefix,
  timestamp: (options: RenameTemplateTokenContext) => formatUtcFileDateTime(options.mtimeDate),
  timestamp_utc: (options: RenameTemplateTokenContext) => formatUtcFileDateTime(options.mtimeDate),
  timestamp_local: (options: RenameTemplateTokenContext) =>
    formatLocalFileDateTime(options.mtimeDate),
  timestamp_local_iso: (options: RenameTemplateTokenContext) =>
    formatLocalFileDateTimeISO(options.mtimeDate),
  timestamp_utc_iso: (options: RenameTemplateTokenContext) =>
    formatUtcFileDateTimeISO(options.mtimeDate),
  timestamp_local_12h: (options: RenameTemplateTokenContext) =>
    formatLocalFileDateTime12Hour(options.mtimeDate),
  timestamp_utc_12h: (options: RenameTemplateTokenContext) =>
    formatUtcFileDateTime12Hour(options.mtimeDate),
  date: (options: RenameTemplateTokenContext) => formatLocalDate(options.mtimeDate),
  date_local: (options: RenameTemplateTokenContext) => formatLocalDate(options.mtimeDate),
  date_utc: (options: RenameTemplateTokenContext) => formatUtcDate(options.mtimeDate),
  stem: (options: RenameTemplateTokenContext) => options.stem,
  uid: (options: RenameTemplateTokenContext) => options.uidText ?? "",
} as const;

export const RENAME_TEMPLATE_SIMPLE_TOKENS = new Set(Object.keys(RENAME_TEMPLATE_TOKEN_RENDERERS));

export const RENAME_TEMPLATE_ALLOWED_PLACEHOLDERS = [
  ...Object.keys(RENAME_TEMPLATE_TOKEN_RENDERERS).map((token) => `{${token}}`),
  "{serial...}",
].join(", ");

export function renderRenameTemplateToken(
  token: string,
  options: RenameTemplateTokenContext,
): string {
  const renderer =
    RENAME_TEMPLATE_TOKEN_RENDERERS[token as keyof typeof RENAME_TEMPLATE_TOKEN_RENDERERS];
  if (renderer) {
    return renderer(options);
  }
  if (token === "serial" || token.startsWith("serial_")) {
    return options.serialText ?? "";
  }
  return "";
}
