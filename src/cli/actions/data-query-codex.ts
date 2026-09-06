import { resolveCodexExecution, type CodexExecutionOptions } from "../../utils/codex-execution";
import { formatCodexTimeoutFailure } from "../../utils/codex-request-failure";
import { DEFAULT_CODEX_REQUEST_TIMEOUT_MS } from "../../utils/codex-timeout";
import {
  collectDataQuerySourceIntrospection,
  collectDataQueryWorkspaceIntrospection,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  type DataQueryInputFormat,
  type DataQueryRelationBinding,
} from "../duckdb/query";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import { createInteractiveAnalyzerStatus } from "../interactive/analyzer-status";
import {
  draftDataQueryWithCodex,
  normalizeDataQueryCodexIntent,
  renderDataQueryCodexDraft,
  type DataQueryCodexRunner,
} from "../data-query/codex";
import { CliError } from "../errors";
import { assertNonEmpty, ensureFileExists, printLine } from "./shared";

const DATA_QUERY_CODEX_SAMPLE_ROWS = 5;

export interface DataQueryCodexOptions {
  codexExecution?: CodexExecutionOptions;
  bodyStartRow?: number;
  headerRow?: number;
  input: string;
  inputFormat?: DataQueryInputFormat;
  intent: string;
  mode?: "single-source" | "workspace";
  printSql?: boolean;
  range?: string;
  relations?: DataQueryRelationBinding[];
  runner?: DataQueryCodexRunner;
  source?: string;
  timeoutMs?: number;
}

function classifyCodexDraftingFailure(message: string): { code: string; prefix: string } {
  if (
    /codex exec exited/i.test(message) ||
    /missing optional dependency/i.test(message) ||
    /spawn/i.test(message) ||
    /enoent/i.test(message) ||
    /auth/i.test(message) ||
    /sign in/i.test(message) ||
    /api key/i.test(message)
  ) {
    return {
      code: "CODEX_UNAVAILABLE",
      prefix: "Codex drafting unavailable",
    };
  }

  return {
    code: "DATA_QUERY_CODEX_FAILED",
    prefix: "Codex drafting failed",
  };
}

function validateDataQueryCodexOptions(options: DataQueryCodexOptions): void {
  if ((options.relations?.length ?? 0) > 0 && options.source?.trim()) {
    throw new CliError("--relation cannot be used together with --source.", {
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
}

export async function actionDataQueryCodex(
  runtime: CliRuntime,
  options: DataQueryCodexOptions,
): Promise<void> {
  const codexExecution = resolveCodexExecution(options.codexExecution);
  validateDataQueryCodexOptions(options);
  const input = assertNonEmpty(options.input, "Input path");
  const inputPath = resolveFromCwd(runtime, input);
  await ensureFileExists(inputPath, "Input");

  const intent = normalizeDataQueryCodexIntent(assertNonEmpty(options.intent, "Intent"));
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
  const bodyStartRow = options.bodyStartRow;
  const headerRow = options.headerRow;
  const range = options.range?.trim() || undefined;
  const relations = options.relations ?? [];
  const mode = options.mode ?? (relations.length > 0 ? "workspace" : "single-source");
  const source = options.source?.trim() || undefined;
  const statusStream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };
  const status = statusStream.isTTY
    ? createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled)
    : {
        start() {},
        update() {},
        wait() {},
        stop() {},
      };

  let connection;
  try {
    connection = await createDuckDbConnection();
    status.start("Introspecting data source...");
    const introspection =
      mode === "workspace"
        ? await collectDataQueryWorkspaceIntrospection(
            connection,
            inputPath,
            format,
            relations,
            DATA_QUERY_CODEX_SAMPLE_ROWS,
          )
        : await collectDataQuerySourceIntrospection(
            connection,
            inputPath,
            format,
            {
              bodyStartRow,
              headerRow,
              range,
              source,
            },
            DATA_QUERY_CODEX_SAMPLE_ROWS,
          );
    status.wait("Drafting SQL with Codex");
    const draftResult = await draftDataQueryWithCodex({
      codexExecution,
      format,
      intent,
      introspection,
      runner: options.runner,
      timeoutMs: options.timeoutMs,
      workingDirectory: runtime.cwd,
    });

    if (!draftResult.draft) {
      if (draftResult.failureKind === "timeout") {
        throw new CliError(
          formatCodexTimeoutFailure({
            attemptsUsed: 1,
            requestLabel: "Codex data-query drafting request",
            timeoutMs: options.timeoutMs ?? DEFAULT_CODEX_REQUEST_TIMEOUT_MS,
          }),
          {
            code: "DATA_QUERY_CODEX_FAILED",
            exitCode: 2,
          },
        );
      }
      const message = draftResult.errorMessage ?? "Unknown Codex drafting failure.";
      const failure = classifyCodexDraftingFailure(message);
      throw new CliError(`${failure.prefix}: ${message}`, {
        code: failure.code,
        exitCode: 2,
      });
    }

    status.stop();

    if (options.printSql) {
      printLine(runtime.stdout, draftResult.draft.sql);
      return;
    }

    renderDataQueryCodexDraft({
      draft: draftResult.draft,
      format,
      intent,
      introspection,
      runtime,
    });
  } finally {
    status.stop();
    connection?.closeSync();
  }
}
