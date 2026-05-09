import { extname } from "node:path";

import type { DataQueryInputFormat } from "../../duckdb/query";
import { CliError } from "../../errors";
import { assertNonEmpty } from "../shared";
import type { DataQueryOptions } from "./index";

export function normalizeOutputExtension(outputPath: string): ".csv" | ".json" {
  const extension = extname(outputPath).toLowerCase();
  if (extension === ".json" || extension === ".csv") {
    return extension;
  }
  throw new CliError("Unsupported --output extension. Use .json or .csv.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function validateDataQueryOptions(options: DataQueryOptions): void {
  if (options.json && options.output) {
    throw new CliError("--json cannot be used together with --output.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const outputExtension = options.output ? normalizeOutputExtension(options.output) : undefined;
  if (options.pretty && !options.json && outputExtension !== ".json") {
    throw new CliError("--pretty requires either --json or a .json --output path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && options.headerMapping) {
    throw new CliError("--codex-suggest-headers cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && options.output) {
    throw new CliError(
      "--codex-suggest-headers stops after writing a header mapping artifact and cannot be used with --output.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.codexSuggestHeaders && options.json) {
    throw new CliError(
      "--codex-suggest-headers stops before SQL execution and cannot be used with --json.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.writeHeaderMapping && !options.codexSuggestHeaders) {
    throw new CliError("--write-header-mapping requires --codex-suggest-headers.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.source?.trim()) {
    throw new CliError("--relation cannot be used together with --source.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.sourceShape?.trim()) {
    throw new CliError("--relation cannot be used together with --source-shape.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.headerMapping?.trim()) {
    throw new CliError("--relation cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.codexSuggestHeaders) {
    throw new CliError("--relation cannot be used together with --codex-suggest-headers.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.range?.trim()) {
    throw new CliError("--relation cannot be used together with --range.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.headerRow !== undefined) {
    throw new CliError("--relation cannot be used together with --header-row.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if ((options.relations?.length ?? 0) > 0 && options.bodyStartRow !== undefined) {
    throw new CliError("--relation cannot be used together with --body-start-row.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.source?.trim()) {
    throw new CliError(
      "--source-shape cannot be used together with --source in the current replay flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.sourceShape?.trim() && options.range?.trim()) {
    throw new CliError(
      "--source-shape cannot be used together with --range in the current replay flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.sourceShape?.trim() && options.headerRow !== undefined) {
    throw new CliError(
      "--source-shape cannot be used together with --header-row in the current replay flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.sourceShape?.trim() && options.bodyStartRow !== undefined) {
    throw new CliError(
      "--source-shape cannot be used together with --body-start-row in the current replay flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

export function isDuckDbBuiltInQueryFormat(format: DataQueryInputFormat): boolean {
  return format === "csv" || format === "tsv" || format === "parquet" || format === "duckdb";
}

export function validateDataQueryFormatOptions(options: {
  format: DataQueryInputFormat;
  installMissingExtension?: boolean;
  noHeader: boolean;
}): void {
  if (options.noHeader && options.format !== "csv" && options.format !== "tsv") {
    throw new CliError("--no-header is only valid for CSV and TSV query inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.installMissingExtension && isDuckDbBuiltInQueryFormat(options.format)) {
    throw new CliError(
      "--install-missing-extension is only valid for extension-backed query formats (sqlite, excel).",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

export function normalizeSql(sql: string): string {
  const value = assertNonEmpty(sql, "SQL");
  return value.endsWith(";") ? value : value;
}
