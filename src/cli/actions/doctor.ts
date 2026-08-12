import { inspectCodexEnvironment } from "../../adapters/codex/shared";
import { getCliColors } from "../colors";
import { inspectCommand } from "../deps";
import type { DependencyCommandRunner } from "../deps";
import { createDuckDbExtensionInstallCommand } from "../duckdb/extensions";
import { inspectDataQueryExtensions } from "../duckdb/query";
import { assessMarkdownPdfRendererCapabilities } from "../markdown-pdf/renderer-capabilities";
import { assessMarkdownPdfRequirements } from "../markdown-pdf/requirements";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DoctorOptions {
  json?: boolean;
  dependencyRunner?: DependencyCommandRunner;
}

function markdownPdfCapabilityStatus(
  requirements: ReturnType<typeof assessMarkdownPdfRequirements>,
): "available" | "unavailable" | "unsupported" | "unverified" {
  if (requirements.ready) {
    return "available";
  }
  if (
    requirements.requirements.pandoc.status === "missing" ||
    requirements.requirements.weasyprint.status === "missing"
  ) {
    return "unavailable";
  }
  return requirements.requirements.pandoc.status === "unsupported" ? "unsupported" : "unverified";
}

function markdownPdfCapabilityDetail(
  requirements: ReturnType<typeof assessMarkdownPdfRequirements>,
): string | undefined {
  const details: string[] = [];
  const pandoc = requirements.requirements.pandoc;
  const weasyprint = requirements.requirements.weasyprint;

  if (pandoc.status === "missing") {
    details.push("Pandoc is missing");
  } else if (pandoc.status === "unsupported") {
    details.push(
      `Pandoc ${pandoc.version ?? "unknown"} is below the required ${pandoc.minimumVersion}`,
    );
  } else if (pandoc.status === "unverified") {
    details.push(`Pandoc ${pandoc.minimumVersion} or newer could not be verified`);
  }
  if (weasyprint.status === "missing") {
    details.push("WeasyPrint is missing");
  }

  return details.length > 0 ? details.join("; ") : undefined;
}

export async function actionDoctor(
  runtime: CliRuntime,
  options: DoctorOptions = {},
): Promise<void> {
  const pc = getCliColors(runtime);
  const [
    pandoc,
    ffmpeg,
    weasyprint,
    fontconfigDiscovery,
    fontconfigCoverage,
    queryExtensions,
    codexEnvironment,
  ] = await Promise.all([
    inspectCommand("pandoc", runtime.platform, options.dependencyRunner),
    inspectCommand("ffmpeg", runtime.platform, options.dependencyRunner),
    inspectCommand("weasyprint", runtime.platform, options.dependencyRunner),
    inspectCommand("fc-list", runtime.platform, options.dependencyRunner),
    inspectCommand("fc-query", runtime.platform, options.dependencyRunner),
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

  const markdownPdfRequirements = assessMarkdownPdfRequirements(pandoc, weasyprint);
  const rendererCapabilities = assessMarkdownPdfRendererCapabilities({ renderer: weasyprint });
  const markdownPdf = {
    ...markdownPdfRequirements,
    rendererCapabilities,
  };
  const capabilities = {
    "md.to-docx": pandoc.available,
    "md.to-pdf": markdownPdf.ready,
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
    "font.discovery.fontconfig": fontconfigDiscovery.available,
    "font.coverage.fontconfig": fontconfigCoverage.available,
  };

  const font = {
    discovery: {
      fontconfig: {
        command: "fc-list",
        available: fontconfigDiscovery.available,
        version: fontconfigDiscovery.version,
      },
    },
    coverage: {
      fontconfig: {
        command: "fc-query",
        available: fontconfigCoverage.available,
        version: fontconfigCoverage.version,
      },
    },
  };

  if (options.json) {
    const payload = {
      generatedAt: runtime.now().toISOString(),
      platform: runtime.platform,
      nodeVersion: process.version,
      tools: { pandoc, ffmpeg, weasyprint },
      markdownPdf,
      query: {
        available: queryExtensions.available,
        detail: queryExtensions.detail,
        formats: queryFormats,
        runtimeVersion: queryExtensions.runtimeVersion,
      },
      queryCodex,
      font,
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
    if (capability === "md.to-pdf") {
      const status = markdownPdfCapabilityStatus(markdownPdf);
      const detail = markdownPdfCapabilityDetail(markdownPdf);
      const statusText =
        status === "available"
          ? pc.green(status)
          : status === "unavailable"
            ? pc.red(status)
            : pc.yellow(status);
      printLine(
        runtime.stdout,
        `- ${pc.bold(capability)}: ${statusText}${detail ? ` (${detail})` : ""}`,
      );
      continue;
    }
    printLine(
      runtime.stdout,
      `- ${pc.bold(capability)}: ${available ? pc.green("available") : pc.red("unavailable")}`,
    );
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Markdown PDF renderer capabilities:")));
  const rendererVersion = rendererCapabilities.renderer.version ?? "unknown version";
  const rendererAvailability = rendererCapabilities.renderer.available
    ? pc.green(`installed (${rendererVersion})`)
    : pc.red("missing");
  printLine(runtime.stdout, `- ${pc.bold("weasyprint")}: ${rendererAvailability}`);
  for (const capability of rendererCapabilities.capabilities) {
    const status =
      capability.status === "satisfied"
        ? pc.green(capability.status)
        : capability.status === "missing"
          ? pc.red(capability.status)
          : pc.yellow(capability.status);
    const diagnostic = capability.diagnosticConditionId
      ? `, diagnostic=${capability.diagnosticConditionId}`
      : "";
    printLine(
      runtime.stdout,
      `- ${pc.bold(capability.id)}: ${status}, minimum=${capability.minimumVersion}${diagnostic}`,
    );
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Font support:")));
  const fontDiscoveryStatus = fontconfigDiscovery.available
    ? pc.green(`available (${fontconfigDiscovery.version ?? "unknown version"})`)
    : pc.red("unavailable");
  const fontCoverageStatus = fontconfigCoverage.available
    ? pc.green(`available (${fontconfigCoverage.version ?? "unknown version"})`)
    : pc.red("unavailable");
  printLine(runtime.stdout, `- ${pc.bold("fontconfig discovery")}: ${fontDiscoveryStatus}`);
  printLine(runtime.stdout, `- ${pc.bold("fontconfig coverage")}: ${fontCoverageStatus}`);

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
