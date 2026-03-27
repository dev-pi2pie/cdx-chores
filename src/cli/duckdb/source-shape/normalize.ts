import { randomUUID } from "node:crypto";
import { relative } from "node:path";

import { CliError } from "../../errors";
import {
  ensureNonEmptyString,
  isRecord,
  normalizeArtifactPath,
  normalizeOptionalPositiveInteger,
} from "../header-mapping/normalize";
import type { DataSourceShapeInputReference } from "./types";

export {
  ensureNonEmptyString,
  isRecord,
  normalizeArtifactPath,
  normalizeOptionalPositiveInteger,
} from "../header-mapping/normalize";

export function ensureKnownSourceShapeInputFormat(value: unknown, context: string): "excel" {
  const normalized = ensureNonEmptyString(value, context);
  if (normalized === "excel") {
    return normalized;
  }
  throw new CliError(`Invalid source shape artifact: ${context} must be excel.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function throwUnsupportedSourceShapeVersion(
  version: unknown,
  options: { rewriting?: boolean } = {},
): never {
  const suffix = options.rewriting ? " Cannot preserve it safely while rewriting." : "";
  throw new CliError(`Unsupported source shape artifact version: ${String(version)}.${suffix}`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function createSourceShapeInputReference(options: {
  cwd: string;
  format: "excel";
  inputPath: string;
  source: string;
}): DataSourceShapeInputReference {
  const normalizedRelativePath = normalizeArtifactPath(
    relative(options.cwd, options.inputPath) || ".",
  );
  return {
    format: options.format,
    path: normalizedRelativePath,
    source: options.source.trim(),
  };
}

export function generateDataSourceShapeFileName(): string {
  return `data-source-shape-${randomUUID().replace(/-/g, "").slice(0, 10)}.json`;
}
