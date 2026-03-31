import { InvalidArgumentError } from "commander";

import type {
  RenameCleanupConflictStrategy,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "../actions/rename";
import {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  type DataQueryInputFormat,
  type DataQueryRelationBinding,
} from "../duckdb/query";
import {
  DUCKDB_MANAGED_EXTENSION_NAMES,
  type DuckDbManagedExtensionName,
} from "../duckdb/extensions";
import {
  RENAME_SERIAL_ORDER_VALUES,
  RENAME_SERIAL_SCOPE_VALUES,
  TIMESTAMP_TIMEZONE_VALUES,
  type RenameSerialOrder,
  type RenameSerialScope,
  type TimestampTimezone,
} from "../rename-template";

export function collectCsvListOption(value: string, previous: string[] = []): string[] {
  const next = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...previous, ...next];
}

export function collectRepeatedOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

const DATA_QUERY_RELATION_ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseDataQueryRelationBindingOptionValue(value: string): DataQueryRelationBinding {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidArgumentError("--relation requires a non-empty binding.");
  }

  const separatorIndex = trimmed.indexOf("=");
  const alias = (separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed).trim();
  const source = (separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed).trim();

  if (!alias || !source) {
    throw new InvalidArgumentError("--relation must use either <name> or <alias>=<source> syntax.");
  }

  if (!DATA_QUERY_RELATION_ALIAS_PATTERN.test(alias)) {
    throw new InvalidArgumentError(
      "--relation alias must be a simple SQL identifier (letters, numbers, underscore; cannot start with a number).",
    );
  }

  return {
    alias,
    source,
  };
}

export function parseDataQueryRelationBindingOptionValues(
  value: string,
): DataQueryRelationBinding[] {
  const bindings = value.split(",").map((item) => item.trim());

  if (bindings.some((binding) => binding.length === 0)) {
    throw new InvalidArgumentError(
      "--relation bundle cannot contain empty bindings. Use comma-separated <name> or <alias>=<source> entries.",
    );
  }

  return bindings.map((binding) => parseDataQueryRelationBindingOptionValue(binding));
}

export function collectDataQueryRelationBindingOption(
  value: string,
  previous: DataQueryRelationBinding[] = [],
): DataQueryRelationBinding[] {
  return [...previous, ...parseDataQueryRelationBindingOptionValues(value)];
}

export function parseNonNegativeIntegerOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

export function parsePositiveIntegerOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function parsePositiveNumberOption(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`${label} must be a positive number.`);
  }
  return parsed;
}

export function parseSerialOrderOption(value: string): RenameSerialOrder {
  if ((RENAME_SERIAL_ORDER_VALUES as readonly string[]).includes(value)) {
    return value as RenameSerialOrder;
  }
  throw new InvalidArgumentError(
    `--serial-order must be one of: ${RENAME_SERIAL_ORDER_VALUES.join(", ")}.`,
  );
}

export function parseSerialScopeOption(value: string): RenameSerialScope {
  if ((RENAME_SERIAL_SCOPE_VALUES as readonly string[]).includes(value)) {
    return value as RenameSerialScope;
  }
  throw new InvalidArgumentError(
    `--serial-scope must be one of: ${RENAME_SERIAL_SCOPE_VALUES.join(", ")}.`,
  );
}

export function parseTimestampTimezoneOption(value: string): TimestampTimezone {
  const normalized = value.trim().toLowerCase();
  if ((TIMESTAMP_TIMEZONE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as TimestampTimezone;
  }
  throw new InvalidArgumentError(
    `--timestamp-timezone must be one of: ${TIMESTAMP_TIMEZONE_VALUES.join(", ")}.`,
  );
}

export function parseDataQueryInputFormatOption(value: string): DataQueryInputFormat {
  const normalized = value.trim().toLowerCase();
  if ((DATA_QUERY_INPUT_FORMAT_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DataQueryInputFormat;
  }
  throw new InvalidArgumentError(
    `--input-format must be one of: ${DATA_QUERY_INPUT_FORMAT_VALUES.join(", ")}.`,
  );
}

export function parseDuckDbManagedExtensionOption(value: string): DuckDbManagedExtensionName {
  const normalized = value.trim().toLowerCase();
  if ((DUCKDB_MANAGED_EXTENSION_NAMES as readonly string[]).includes(normalized)) {
    return normalized as DuckDbManagedExtensionName;
  }
  throw new InvalidArgumentError(
    `Extension name must be one of: ${DUCKDB_MANAGED_EXTENSION_NAMES.join(", ")}.`,
  );
}

export function parseRenameCleanupStyleOption(value: string): RenameCleanupStyle {
  const normalized = value.trim().toLowerCase();
  if (normalized === "preserve" || normalized === "slug") {
    return normalized;
  }
  throw new InvalidArgumentError("--style must be one of: preserve, slug.");
}

export function parseRenameCleanupTimestampActionOption(
  value: string,
): RenameCleanupTimestampAction {
  const normalized = value.trim().toLowerCase();
  if (normalized === "keep" || normalized === "remove") {
    return normalized;
  }
  throw new InvalidArgumentError("--timestamp-action must be one of: keep, remove.");
}

export function parseRenameCleanupConflictStrategyOption(
  value: string,
): RenameCleanupConflictStrategy {
  const normalized = value.trim().toLowerCase();
  if (normalized === "skip" || normalized === "number" || normalized === "uid-suffix") {
    return normalized;
  }
  throw new InvalidArgumentError("--conflict-strategy must be one of: skip, number, uid-suffix.");
}
