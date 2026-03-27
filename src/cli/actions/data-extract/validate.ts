import { CliError } from "../../errors";
import { normalizeOutputFormat } from "./materialize";
import type { DataExtractOptions } from "./types";

export function validateDataExtractOptions(options: DataExtractOptions): void {
  const normalizedOutput = options.output?.trim();

  if (options.codexSuggestShape && options.headerMapping) {
    throw new CliError("--codex-suggest-shape cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestShape && options.codexSuggestHeaders) {
    throw new CliError(
      "--codex-suggest-shape cannot be used together with --codex-suggest-headers.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.codexSuggestShape && options.range?.trim()) {
    throw new CliError(
      "--codex-suggest-shape cannot be used together with --range in the first pass.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.codexSuggestShape && options.headerRow !== undefined) {
    throw new CliError(
      "--codex-suggest-shape cannot be used together with --header-row in the current reviewed-shape flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.codexSuggestShape && options.bodyStartRow !== undefined) {
    throw new CliError(
      "--codex-suggest-shape cannot be used together with --body-start-row in the current reviewed-shape flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.codexSuggestHeaders && options.headerMapping) {
    throw new CliError("--codex-suggest-headers cannot be used together with --header-mapping.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.codexSuggestHeaders && normalizedOutput) {
    throw new CliError(
      "--codex-suggest-headers stops after writing a header mapping artifact and cannot be used with --output.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.codexSuggestShape && normalizedOutput) {
    throw new CliError(
      "--codex-suggest-shape stops after writing a source shape artifact and cannot be used with --output.",
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

  if (options.writeSourceShape && !options.codexSuggestShape) {
    throw new CliError("--write-source-shape requires --codex-suggest-shape.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.range?.trim()) {
    throw new CliError("--source-shape cannot be used together with --range in the first pass.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (options.sourceShape?.trim() && options.headerRow !== undefined) {
    throw new CliError(
      "--source-shape cannot be used together with --header-row in the current reviewed-shape flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (options.sourceShape?.trim() && options.bodyStartRow !== undefined) {
    throw new CliError(
      "--source-shape cannot be used together with --body-start-row in the current reviewed-shape flow.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  if (!options.codexSuggestHeaders && !options.codexSuggestShape && !normalizedOutput) {
    throw new CliError("--output is required for data extract materialization runs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (normalizedOutput) {
    normalizeOutputFormat(normalizedOutput);
  }
}
