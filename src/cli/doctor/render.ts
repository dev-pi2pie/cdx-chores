import { printLine } from "../actions/shared";
import { getCliColors } from "../colors";
import { createDuckDbExtensionInstallCommand } from "../duckdb/extensions";
import type { CliRuntime } from "../types";
import type { DoctorReport } from "./report";
import type { DoctorWorkflowId, DoctorWorkflowProjection, DoctorWorkflowState } from "./workflow";

function markdownPdfCapabilityStatus(
  requirements: DoctorReport["markdownPdf"],
): "available" | "unavailable" | "unsupported" | "unverified" {
  if (requirements.ready) return "available";
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
  if (pandoc.status === "missing") {
    details.push("Pandoc is missing");
  } else if (pandoc.status === "unsupported") {
    details.push(
      `Pandoc ${pandoc.version ?? "unknown"} is below the required ${pandoc.minimumVersion}`,
    );
  } else if (pandoc.status === "unverified") {
    details.push(`Pandoc ${pandoc.minimumVersion} or newer could not be verified`);
  }
  if (requirements.requirements.weasyprint.status === "missing") {
    details.push("WeasyPrint is missing");
  }
  return details.length > 0 ? details.join("; ") : undefined;
}

function renderWorkflowState(
  state: DoctorWorkflowState,
  pc: ReturnType<typeof getCliColors>,
): string {
  if (state === "ready") return pc.green(state);
  if (state === "unavailable") return pc.red(state);
  return pc.yellow(state);
}

function workflowLabels(
  projection: DoctorWorkflowProjection,
  ids: readonly DoctorWorkflowId[],
): string {
  const labels = new Map(projection.workflows.map((workflow) => [workflow.id, workflow.label]));
  return ids.map((id) => labels.get(id) ?? id).join(", ");
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function renderCompactDoctorReport(
  runtime: CliRuntime,
  projection: DoctorWorkflowProjection,
): void {
  const pc = getCliColors(runtime);
  const workflows = new Map(projection.workflows.map((workflow) => [workflow.id, workflow]));
  const state = (id: DoctorWorkflowId) => {
    const workflow = workflows.get(id);
    return workflow ? renderWorkflowState(workflow.state, pc) : pc.yellow("unknown");
  };

  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores doctor")));
  printLine(runtime.stdout);
  printLine(
    runtime.stdout,
    `${formatCount(projection.issueCount, "issue")} · ${formatCount(projection.actionCount, "action")}`,
  );
  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Workflows:")));
  printLine(runtime.stdout, pc.bold("Markdown"));
  printLine(runtime.stdout, `  ${pc.bold("DOCX")}: ${state("markdown.docx")}`);
  printLine(runtime.stdout, `  ${pc.bold("PDF")}: ${state("markdown.pdf")}`);
  printLine(runtime.stdout, `${pc.bold("Video")}: ${state("video")}`);
  printLine(runtime.stdout, `${pc.bold("Data query")}: ${state("data.query")}`);
  printLine(
    runtime.stdout,
    `${pc.bold("Codex-assisted data query")}: ${state("data.query.codex")}`,
  );
  printLine(runtime.stdout, pc.bold("Fonts"));
  printLine(runtime.stdout, `  ${pc.bold("Discovery")}: ${state("font.discovery")}`);
  printLine(runtime.stdout, `  ${pc.bold("Coverage")}: ${state("font.coverage")}`);

  if (projection.conditions.length > 0) {
    printLine(runtime.stdout);
    printLine(runtime.stdout, pc.bold(pc.cyan("Issues:")));
    for (const condition of projection.conditions) {
      printLine(
        runtime.stdout,
        `- ${condition.message} (${workflowLabels(projection, condition.affectedWorkflowIds)})`,
      );
    }
  }

  if (projection.actions.length > 0) {
    printLine(runtime.stdout);
    printLine(runtime.stdout, pc.bold(pc.cyan("Actions:")));
    for (const action of projection.actions) {
      const actionClass =
        action.class === "required" ? pc.red(action.class) : pc.yellow(action.class);
      printLine(runtime.stdout, `- ${action.message} [${actionClass}]`);
      printLine(
        runtime.stdout,
        `  Affects: ${workflowLabels(projection, action.affectedWorkflowIds)}`,
      );
      if (action.command) {
        printLine(runtime.stdout, `  Command: ${action.command}`);
      }
    }
  }

  printLine(runtime.stdout);
  printLine(
    runtime.stdout,
    "Run `cdx-chores doctor --details` for versions and capability evidence.",
  );
}

export function renderDetailedDoctorReport(runtime: CliRuntime, report: DoctorReport): void {
  const pc = getCliColors(runtime);
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
  } else {
    if (queryExtensions.runtimeVersion) {
      printLine(
        runtime.stdout,
        `${pc.dim("DuckDB runtime:")} ${pc.white(queryExtensions.runtimeVersion)}`,
      );
    }
    for (const [format, formatState] of Object.entries(queryFormats)) {
      if (formatState.kind === "core") {
        printLine(
          runtime.stdout,
          `- ${pc.bold(format)}: built-in DuckDB support=${formatState.detectedSupport ? "yes" : "no"}`,
        );
        continue;
      }
      const installability =
        formatState.installability === null ? "unknown" : formatState.installability ? "yes" : "no";
      printLine(
        runtime.stdout,
        `- ${pc.bold(format)}: detected support=${formatState.detectedSupport ? "yes" : "no"}, loadability=${formatState.loadability ? "yes" : "no"}, installability=${installability}`,
      );
      if (formatState.detail) {
        printLine(runtime.stdout, `  ${pc.dim(formatState.detail)}`);
      }
      if (
        !formatState.loadability &&
        formatState.installability === true &&
        (format === "sqlite" || format === "excel")
      ) {
        printLine(
          runtime.stdout,
          `  ${pc.yellow(`Try: ${createDuckDbExtensionInstallCommand(format)}`)}`,
        );
      }
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
