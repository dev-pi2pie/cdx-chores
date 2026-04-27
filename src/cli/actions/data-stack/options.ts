import type { DataStackCodexRunner } from "../../data-stack/codex-assist";
import {
  DATA_STACK_DUPLICATE_POLICY_VALUES,
  type DataStackDuplicatePolicy,
} from "../../data-stack/plan";
import type { DataStackInputFormat, DataStackSchemaModeOption } from "../../data-stack/types";
import { CliError } from "../../errors";

export interface DataStackOptions {
  codexAssist?: boolean;
  codexReportOutput?: string;
  codexRunner?: DataStackCodexRunner;
  codexTimeoutMs?: number;
  columns?: string[];
  dryRun?: boolean;
  excludeColumns?: string[];
  inputFormat?: DataStackInputFormat;
  maxDepth?: number;
  noHeader?: boolean;
  onDuplicate?: DataStackDuplicatePolicy;
  output?: string;
  overwrite?: boolean;
  pattern?: string;
  planOutput?: string;
  recursive?: boolean;
  schemaMode?: DataStackSchemaModeOption;
  unionByName?: boolean;
  uniqueBy?: string[];
  sources: string[];
}

export function resolveDataStackSchemaModeOption(
  options: DataStackOptions,
): DataStackSchemaModeOption {
  if (
    options.unionByName === true &&
    options.schemaMode &&
    options.schemaMode !== "union-by-name"
  ) {
    throw new CliError(
      "--union-by-name cannot be combined with --schema-mode other than union-by-name.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return options.unionByName === true ? "union-by-name" : (options.schemaMode ?? "strict");
}

export function validateDataStackOptions(options: DataStackOptions): void {
  if (options.sources.length === 0) {
    throw new CliError("At least one input source is required for data stack.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  resolveDataStackSchemaModeOption(options);

  if (!options.output?.trim()) {
    throw new CliError("--output is required for data stack runs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.columns && options.columns.length === 0) {
    throw new CliError("--columns requires at least one column name.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.columns?.length ?? 0) > 0 && options.noHeader !== true) {
    throw new CliError("--columns requires --no-header.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.columns?.length ?? 0) > 0) {
    const normalizedColumns =
      options.columns?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];
    if (normalizedColumns.length !== options.columns?.length) {
      throw new CliError("--columns cannot contain empty names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (
      new Set(normalizedColumns.map((value) => value.toLowerCase())).size !==
      normalizedColumns.length
    ) {
      throw new CliError("--columns cannot contain duplicate names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }

  if (!options.dryRun && options.planOutput?.trim()) {
    throw new CliError("--plan-output requires --dry-run.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexAssist && !options.dryRun) {
    throw new CliError("--codex-assist requires --dry-run.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexReportOutput?.trim() && !options.codexAssist) {
    throw new CliError("--codex-report-output requires --codex-assist.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (
    options.onDuplicate &&
    !(DATA_STACK_DUPLICATE_POLICY_VALUES as readonly string[]).includes(options.onDuplicate)
  ) {
    throw new CliError(
      `--on-duplicate must be one of: ${DATA_STACK_DUPLICATE_POLICY_VALUES.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.uniqueBy) {
    const normalizedUniqueBy = options.uniqueBy
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (normalizedUniqueBy.length !== options.uniqueBy.length || normalizedUniqueBy.length === 0) {
      throw new CliError("--unique-by requires at least one non-empty column or key name.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (
      new Set(normalizedUniqueBy.map((value) => value.toLowerCase())).size !==
      normalizedUniqueBy.length
    ) {
      throw new CliError("--unique-by cannot contain duplicate names.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
  }
}
