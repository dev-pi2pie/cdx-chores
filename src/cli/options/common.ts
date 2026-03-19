import type { Command } from "commander";

import {
  DEFAULT_RENAME_SERIAL_ORDER,
  DEFAULT_RENAME_SERIAL_START,
  RENAME_SERIAL_ORDER_VALUES,
  RENAME_SERIAL_SCOPE_VALUES,
  TIMESTAMP_TIMEZONE_VALUES,
} from "../rename-template";
import {
  parseNonNegativeIntegerOption,
  parsePositiveIntegerOption,
  parseSerialOrderOption,
  parseSerialScopeOption,
  parseTimestampTimezoneOption,
} from "./parsers";

export function applyCommonFileOptions(command: Command): Command {
  return command
    .option("-o, --output <path>", "Output file path")
    .option("--overwrite", "Overwrite output file if it already exists", false);
}

export function applyRenameTemplateOptions(command: Command): Command {
  return command
    .option(
      "--pattern <template>",
      "Custom filename template (supports {prefix}, {timestamp}, {timestamp_local}, {timestamp_utc}, {timestamp_local_iso}, {timestamp_utc_iso}, {timestamp_local_12h}, {timestamp_utc_12h}, {date}, {date_local}, {date_utc}, {stem}, {uid}, {serial...})",
    )
    .option(
      "--serial-order <value>",
      `Serial ordering mode override (${RENAME_SERIAL_ORDER_VALUES.join(", ")}). mtime = modified time. Default when unspecified: ${DEFAULT_RENAME_SERIAL_ORDER}.`,
      parseSerialOrderOption,
    )
    .option(
      "--serial-start <value>",
      `Serial start value override (non-negative integer). Default when unspecified: ${DEFAULT_RENAME_SERIAL_START}.`,
      (value) => parseNonNegativeIntegerOption(value, "--serial-start"),
    )
    .option("--serial-width <value>", "Minimum serial width in digits", (value) =>
      parsePositiveIntegerOption(value, "--serial-width"),
    )
    .option(
      "--serial-scope <value>",
      `Serial scope mode override (${RENAME_SERIAL_SCOPE_VALUES.join(", ")}). Default when unspecified: global.`,
      parseSerialScopeOption,
    )
    .option(
      "--timestamp-timezone <value>",
      `Timestamp timezone basis for legacy {timestamp} placeholder (${TIMESTAMP_TIMEZONE_VALUES.join(", ")}). Default when unspecified: utc.`,
      parseTimestampTimezoneOption,
    );
}
