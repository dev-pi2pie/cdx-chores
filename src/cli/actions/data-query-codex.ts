import { resolveFromCwd } from "../fs-utils";
import type { CliRuntime } from "../types";
import { createInteractiveAnalyzerStatus } from "../interactive/analyzer-status";
import {
  collectDataQuerySourceIntrospection,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  type DataQueryInputFormat,
} from "../duckdb/query";
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
  input: string;
  inputFormat?: DataQueryInputFormat;
  intent: string;
  printSql?: boolean;
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

export async function actionDataQueryCodex(
  runtime: CliRuntime,
  options: DataQueryCodexOptions,
): Promise<void> {
  const input = assertNonEmpty(options.input, "Input path");
  const inputPath = resolveFromCwd(runtime, input);
  await ensureFileExists(inputPath, "Input");

  const intent = normalizeDataQueryCodexIntent(assertNonEmpty(options.intent, "Intent"));
  const format = detectDataQueryInputFormat(inputPath, options.inputFormat);
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
    const introspection = await collectDataQuerySourceIntrospection(
      connection,
      inputPath,
      format,
      source,
      DATA_QUERY_CODEX_SAMPLE_ROWS,
    );
    status.wait("Drafting SQL with Codex");
    const draftResult = await draftDataQueryWithCodex({
      format,
      intent,
      introspection,
      runner: options.runner,
      timeoutMs: options.timeoutMs,
      workingDirectory: runtime.cwd,
    });

    if (!draftResult.draft) {
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
