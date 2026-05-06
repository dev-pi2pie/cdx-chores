import { inspectCodexEnvironment } from "../../adapters/codex/shared";
import { getCliColors } from "../colors";
import { inspectCommand } from "../deps";
import { createDuckDbExtensionInstallCommand } from "../duckdb/extensions";
import { inspectDataQueryExtensions } from "../duckdb/query";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DoctorOptions {
  json?: boolean;
}

export async function actionDoctor(
  runtime: CliRuntime,
  options: DoctorOptions = {},
): Promise<void> {
  const pc = getCliColors(runtime);
  const [pandoc, ffmpeg, weasyprint, queryExtensions, codexEnvironment] = await Promise.all([
    inspectCommand("pandoc", runtime.platform),
    inspectCommand("ffmpeg", runtime.platform),
    inspectCommand("weasyprint", runtime.platform),
    inspectDataQueryExtensions(),
    inspectCodexEnvironment(),
  ]);

  const queryFormats = {
    csv: {
      kind: "core" as const,
      detectedSupport: queryExtensions.available,
    },
    tsv: {
      kind: "core" as const,
      detectedSupport: queryExtensions.available,
    },
    parquet: {
      kind: "core" as const,
      detectedSupport: queryExtensions.available,
    },
    duckdb: {
      kind: "core" as const,
      detectedSupport: queryExtensions.available,
    },
    sqlite: {
      kind: "extension" as const,
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.sqlite?.loadable ?? false,
      installability: queryExtensions.sqlite?.installable ?? null,
      detail: queryExtensions.sqlite?.detail,
    },
    excel: {
      kind: "extension" as const,
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.excel?.loadable ?? false,
      installability: queryExtensions.excel?.installable ?? null,
      detail: queryExtensions.excel?.detail,
    },
  };

  const queryCodex = {
    configuredSupport: codexEnvironment.configuredSupport,
    authSessionAvailable: codexEnvironment.authSessionAvailable,
    readyToDraft:
      codexEnvironment.configuredSupport &&
      codexEnvironment.authSessionAvailable &&
      queryExtensions.available,
    detail:
      codexEnvironment.detail ?? (queryExtensions.available ? undefined : queryExtensions.detail),
  };

  const capabilities = {
    "md.to-docx": pandoc.available,
    "md.to-pdf": pandoc.available && weasyprint.available,
    "video.convert": ffmpeg.available,
    "video.resize": ffmpeg.available,
    "video.gif": ffmpeg.available,
    "data.query.csv": queryFormats.csv.detectedSupport,
    "data.query.tsv": queryFormats.tsv.detectedSupport,
    "data.query.parquet": queryFormats.parquet.detectedSupport,
    "data.query.duckdb": queryFormats.duckdb.detectedSupport,
    "data.query.sqlite": queryFormats.sqlite.loadability,
    "data.query.excel": queryFormats.excel.loadability,
    "data.query.codex": queryCodex.readyToDraft,
  };

  if (options.json) {
    const payload = {
      generatedAt: runtime.now().toISOString(),
      platform: runtime.platform,
      nodeVersion: process.version,
      tools: { pandoc, ffmpeg, weasyprint },
      query: {
        available: queryExtensions.available,
        detail: queryExtensions.detail,
        formats: queryFormats,
        runtimeVersion: queryExtensions.runtimeVersion,
      },
      queryCodex,
      capabilities,
    };
    printLine(runtime.stdout, JSON.stringify(payload, null, 2));
    return;
  }

  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores doctor")));
  printLine(runtime.stdout, `${pc.dim("Platform:")} ${pc.white(runtime.platform)}`);
  printLine(runtime.stdout, `${pc.dim("Node.js:")} ${pc.white(process.version)}`);
  printLine(runtime.stdout);

  for (const item of [pandoc, ffmpeg, weasyprint]) {
    const statusText = item.available
      ? pc.green(`available (${item.version ?? "unknown version"})`)
      : pc.red("missing");
    printLine(runtime.stdout, `- ${pc.bold(item.name)}: ${statusText}`);
    if (!item.available) {
      printLine(runtime.stdout, `  ${pc.yellow("Install suggestion:")} ${item.installHint}`);
    }
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Capabilities:")));
  for (const [capability, available] of Object.entries(capabilities)) {
    printLine(
      runtime.stdout,
      `- ${pc.bold(capability)}: ${available ? pc.green("available") : pc.red("unavailable")}`,
    );
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Data query formats:")));
  if (!queryExtensions.available) {
    printLine(
      runtime.stdout,
      `- ${pc.bold("duckdb")}: ${pc.red("unavailable")} ${queryExtensions.detail ? `(${queryExtensions.detail})` : ""}`.trim(),
    );
    return;
  }

  if (queryExtensions.runtimeVersion) {
    printLine(
      runtime.stdout,
      `${pc.dim("DuckDB runtime:")} ${pc.white(queryExtensions.runtimeVersion)}`,
    );
  }

  for (const [format, state] of Object.entries(queryFormats)) {
    if (state.kind === "core") {
      printLine(
        runtime.stdout,
        `- ${pc.bold(format)}: built-in DuckDB support=${state.detectedSupport ? "yes" : "no"}`,
      );
      continue;
    }

    const installability =
      state.installability === null ? "unknown" : state.installability ? "yes" : "no";
    printLine(
      runtime.stdout,
      `- ${pc.bold(format)}: detected support=${state.detectedSupport ? "yes" : "no"}, loadability=${state.loadability ? "yes" : "no"}, installability=${installability}`,
    );
    if (state.detail) {
      printLine(runtime.stdout, `  ${pc.dim(state.detail)}`);
    }
    if (
      !state.loadability &&
      state.installability === true &&
      (format === "sqlite" || format === "excel")
    ) {
      printLine(
        runtime.stdout,
        `  ${pc.yellow(`Try: ${createDuckDbExtensionInstallCommand(format)}`)}`,
      );
    }
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Data query Codex:")));
  printLine(
    runtime.stdout,
    `- ${pc.bold("codex")}: configured support=${queryCodex.configuredSupport ? "yes" : "no"}, auth/session=${queryCodex.authSessionAvailable ? "yes" : "no"}, ready-to-draft=${queryCodex.readyToDraft ? "yes" : "no"}`,
  );
  if (queryCodex.detail) {
    printLine(runtime.stdout, `  ${pc.dim(queryCodex.detail)}`);
  }
}
