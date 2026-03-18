import { randomUUID } from "node:crypto";
import { relative } from "node:path";

import { CliError } from "../../errors";
import type {
  DataHeaderMappingFormat,
  DataHeaderMappingInputReference,
  DataHeaderMappingShape,
} from "./types";

const SUPPORTED_QUERY_INPUT_FORMATS = new Set<DataHeaderMappingFormat>([
  "csv",
  "excel",
  "parquet",
  "sqlite",
  "tsv",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeArtifactPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function ensureKnownQueryInputFormat(
  value: unknown,
  context: string,
): DataHeaderMappingFormat {
  if (
    typeof value === "string" &&
    SUPPORTED_QUERY_INPUT_FORMATS.has(value as DataHeaderMappingFormat)
  ) {
    return value as DataHeaderMappingFormat;
  }
  throw new CliError(
    `Invalid header mapping artifact: ${context} must be one of csv, tsv, parquet, sqlite, excel.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

export function ensureNonEmptyString(value: unknown, context: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new CliError(`Invalid header mapping artifact: ${context} must be a non-empty string.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function throwUnsupportedHeaderMappingVersion(
  version: unknown,
  options: { rewriting?: boolean } = {},
): never {
  const suffix = options.rewriting ? " Cannot preserve it safely while rewriting." : "";
  throw new CliError(`Unsupported header mapping artifact version: ${String(version)}.${suffix}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function normalizeHeaderMappingTargetName(value: string): string {
  const collapsed = value
    .trim()
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();

  if (!collapsed) {
    return "";
  }

  if (/^[\p{N}]/u.test(collapsed)) {
    return `column_${collapsed}`;
  }

  return collapsed;
}

export function createHeaderMappingInputReference(options: {
  cwd: string;
  format: DataHeaderMappingFormat;
  inputPath: string;
  shape?: DataHeaderMappingShape;
}): DataHeaderMappingInputReference {
  const normalizedRelativePath = normalizeArtifactPath(relative(options.cwd, options.inputPath) || ".");
  return {
    format: options.format,
    path: normalizedRelativePath,
    ...(options.shape?.range ? { range: options.shape.range } : {}),
    ...(options.shape?.source ? { source: options.shape.source } : {}),
  };
}

export function generateDataHeaderMappingFileName(): string {
  return `data-header-mapping-${randomUUID().replace(/-/g, "").slice(0, 10)}.json`;
}
