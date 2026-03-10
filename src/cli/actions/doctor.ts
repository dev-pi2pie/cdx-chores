import { getCliColors } from "../colors";
import { inspectCommand } from "../deps";
import { inspectDataQueryExtensions } from "../duckdb/query";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DoctorOptions {
  json?: boolean;
}

export async function actionDoctor(runtime: CliRuntime, options: DoctorOptions = {}): Promise<void> {
  const pc = getCliColors(runtime);
  const [pandoc, ffmpeg, queryExtensions] = await Promise.all([
    inspectCommand("pandoc", runtime.platform),
    inspectCommand("ffmpeg", runtime.platform),
    inspectDataQueryExtensions(),
  ]);

  const queryFormats = {
    csv: {
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.available,
      installability: null,
    },
    tsv: {
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.available,
      installability: null,
    },
    parquet: {
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.available,
      installability: null,
    },
    sqlite: {
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.sqlite?.loadable ?? false,
      installability: queryExtensions.sqlite?.installable ?? null,
      detail: queryExtensions.sqlite?.detail,
    },
    excel: {
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.excel?.loadable ?? false,
      installability: queryExtensions.excel?.installable ?? null,
      detail: queryExtensions.excel?.detail,
    },
  };

  const capabilities = {
    "md.to-docx": pandoc.available,
    "video.convert": ffmpeg.available,
    "video.resize": ffmpeg.available,
    "video.gif": ffmpeg.available,
    "data.query.csv": queryFormats.csv.loadability,
    "data.query.tsv": queryFormats.tsv.loadability,
    "data.query.parquet": queryFormats.parquet.loadability,
    "data.query.sqlite": queryFormats.sqlite.loadability,
    "data.query.excel": queryFormats.excel.loadability,
  };

  if (options.json) {
    const payload = {
      generatedAt: runtime.now().toISOString(),
      platform: runtime.platform,
      nodeVersion: process.version,
      tools: { pandoc, ffmpeg },
      query: {
        available: queryExtensions.available,
        detail: queryExtensions.detail,
        formats: queryFormats,
      },
      capabilities,
    };
    printLine(runtime.stdout, JSON.stringify(payload, null, 2));
    return;
  }

  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores doctor")));
  printLine(runtime.stdout, `${pc.dim("Platform:")} ${pc.white(runtime.platform)}`);
  printLine(runtime.stdout, `${pc.dim("Node.js:")} ${pc.white(process.version)}`);
  printLine(runtime.stdout);

  for (const item of [pandoc, ffmpeg]) {
    const statusText = item.available
      ? pc.green(`available (${item.version ?? "unknown version"})`)
      : pc.red("missing");
    printLine(
      runtime.stdout,
      `- ${pc.bold(item.name)}: ${statusText}`,
    );
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

  for (const [format, state] of Object.entries(queryFormats)) {
    const installability =
      state.installability === null
        ? "unknown"
        : state.installability
          ? "yes"
          : "no";
    printLine(
      runtime.stdout,
      `- ${pc.bold(format)}: detected support=${state.detectedSupport ? "yes" : "no"}, loadability=${state.loadability ? "yes" : "no"}, installability=${installability}`,
    );
    if ("detail" in state && state.detail) {
      printLine(runtime.stdout, `  ${pc.dim(state.detail)}`);
    }
  }
}
