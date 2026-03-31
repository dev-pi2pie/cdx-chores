import { checkbox, confirm, input, select } from "@inquirer/prompts";

import { printLine } from "../../actions/shared";
import {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  detectDataQueryInputFormat,
  type DataQueryInputFormat,
  type DataQueryRelationBinding,
} from "../../duckdb/query";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import type { DataQueryInteractiveScope } from "./types";

export async function promptInteractiveInputFormat(
  runtime: CliRuntime,
  inputPath: string,
): Promise<DataQueryInputFormat> {
  let detected: DataQueryInputFormat | undefined;
  try {
    detected = detectDataQueryInputFormat(inputPath);
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
  }

  if (!detected) {
    printLine(
      runtime.stdout,
      "Automatic format detection could not determine the query input type.",
    );
    return await select<DataQueryInputFormat>({
      message: "Input format",
      choices: DATA_QUERY_INPUT_FORMAT_VALUES.map((format) => ({
        name: format,
        value: format,
      })),
    });
  }

  const useDetected = await confirm({
    message: `Use detected input format: ${detected}?`,
    default: true,
  });
  if (useDetected) {
    return detected;
  }

  return await select<DataQueryInputFormat>({
    message: "Override input format",
    choices: DATA_QUERY_INPUT_FORMAT_VALUES.map((format) => ({
      name: format,
      value: format,
    })),
  });
}

export async function promptOptionalSourceSelection(
  format: DataQueryInputFormat,
  sources: readonly string[] | undefined,
): Promise<string | undefined> {
  if (!sources || sources.length === 0) {
    return undefined;
  }

  return await select<string>({
    message: format === "sqlite" ? "Choose a SQLite source" : "Choose an Excel sheet",
    choices: sources.map((source) => ({
      name: source,
      value: source,
    })),
  });
}

export async function promptInteractiveQueryScope(
  format: DataQueryInputFormat,
  sources: readonly string[] | undefined,
): Promise<DataQueryInteractiveScope> {
  if (format !== "sqlite" || !sources || sources.length < 2) {
    return "single-source";
  }

  return await select<DataQueryInteractiveScope>({
    message: "Choose query scope",
    choices: [
      {
        name: "single-source",
        value: "single-source",
        description: "Bind one SQLite source and keep the `file` shorthand",
      },
      {
        name: "workspace",
        value: "workspace",
        description: "Bind one or more SQLite relations with explicit names",
      },
    ],
  });
}

function validateWorkspaceAlias(value: string): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter a relation name.";
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return "Use a simple SQL identifier (letters, numbers, underscore; cannot start with a number).";
  }
  if (trimmed.toLowerCase() === "file") {
    return "The relation name `file` is reserved in workspace mode.";
  }
  return true;
}

export async function promptWorkspaceRelationBindings(
  format: DataQueryInputFormat,
  sources: readonly string[] | undefined,
): Promise<DataQueryRelationBinding[]> {
  if (format !== "sqlite") {
    return [];
  }
  if (!sources || sources.length === 0) {
    return [];
  }

  const selectedSources = await checkbox<string>({
    message: "Choose SQLite relations for the workspace",
    choices: sources.map((source) => ({
      name: source,
      value: source,
    })),
  });

  if (selectedSources.length === 0) {
    throw new CliError("Select at least one relation for workspace mode.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const bindings: DataQueryRelationBinding[] = [];
  const seenAliases = new Set<string>();

  for (const source of selectedSources) {
    const alias = (
      await input({
        message: `Relation name for ${source}`,
        default: source,
        validate: (value) => {
          const base = validateWorkspaceAlias(String(value));
          if (base !== true) {
            return base;
          }
          const normalized = String(value).trim().toLowerCase();
          return seenAliases.has(normalized)
            ? `Relation name already used: ${String(value).trim()}.`
            : true;
        },
      })
    ).trim();

    seenAliases.add(alias.toLowerCase());
    bindings.push({
      alias,
      source,
    });
  }

  return bindings;
}

export async function promptDelimitedHeaderMode(
  format: DataQueryInputFormat,
): Promise<boolean | undefined> {
  if (format !== "csv" && format !== "tsv") {
    return undefined;
  }

  return await confirm({
    message: "Treat CSV/TSV input as headerless?",
    default: false,
  });
}
