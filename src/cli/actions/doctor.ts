import { getCliColors } from "../colors";
import type { DependencyCommandRunner } from "../deps";
import { inspectDoctor, type DoctorInspectorOverrides } from "../doctor/inspect";
import { serializeDoctorJson } from "../doctor/json";
import { buildDoctorReport, type DoctorReport } from "../doctor/report";
import { createDuckDbExtensionInstallCommand } from "../duckdb/extensions";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DoctorOptions {
  json?: boolean;
  dependencyRunner?: DependencyCommandRunner;
  inspectors?: DoctorInspectorOverrides;
}

function markdownPdfCapabilityStatus(
  requirements: DoctorReport["markdownPdf"],
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
  requirements: DoctorReport["markdownPdf"],
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
  const inspection = await inspectDoctor(runtime, options);
  const report = buildDoctorReport(
    { platform: runtime.platform, nodeVersion: process.version },
    inspection,
  );

  if (options.json) {
    printLine(runtime.stdout, serializeDoctorJson(report, runtime.now().toISOString()));
    return;
  }

  const {
    capabilities,
    font,
    markdownPdf,
    query: queryExtensions,
    queryCodex,
    tools: { ffmpeg, pandoc, weasyprint },
  } = report;
  const { formats: queryFormats } = queryExtensions;
  const fontconfigDiscovery = font.discovery.fontconfig;
  const fontconfigCoverage = font.coverage.fontconfig;
  const rendererCapabilities = markdownPdf.rendererCapabilities;

  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores doctor")));
  printLine(runtime.stdout, `${pc.dim("Platform:")} ${pc.white(report.platform)}`);
  printLine(runtime.stdout, `${pc.dim("Node.js:")} ${pc.white(report.nodeVersion)}`);
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
