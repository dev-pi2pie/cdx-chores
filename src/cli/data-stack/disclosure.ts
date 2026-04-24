import { CliError } from "../errors";
import type { DataStackSchemaMode } from "./types";

export function formatDataStackSchemaMode(mode: DataStackSchemaMode): string {
  return mode === "union-by-name" ? "union-by-name" : "strict";
}

export function formatBoundedDataStackNames(names: readonly string[], limit = 8): string {
  if (names.length <= limit) {
    return names.join(", ");
  }
  return `${names.slice(0, limit).join(", ")} (+${names.length - limit} more)`;
}

export function normalizeDataStackSchemaOptions(options: {
  excludeColumns?: readonly string[];
  noHeader?: boolean;
  schemaMode?: DataStackSchemaMode;
}): { excludeColumns: string[]; schemaMode: DataStackSchemaMode } {
  const schemaMode = options.schemaMode ?? "strict";
  const excludeColumns =
    options.excludeColumns?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];

  if (options.excludeColumns && excludeColumns.length !== options.excludeColumns.length) {
    throw new CliError("--exclude-columns cannot contain empty names.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (excludeColumns.length > 0 && schemaMode !== "union-by-name") {
    throw new CliError("--exclude-columns requires --union-by-name.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (schemaMode === "union-by-name" && options.noHeader) {
    throw new CliError("--union-by-name cannot be used with --no-header.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    excludeColumns,
    schemaMode,
  };
}
