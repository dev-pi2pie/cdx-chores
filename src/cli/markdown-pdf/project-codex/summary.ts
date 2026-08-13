import { printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import { collectMarkdownPdfProfileAuthoringReview } from "../profile-authoring-review";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import {
  escapeMdPdfProjectCodexTerminalText,
  sanitizeMdPdfProjectCodexTerminalText,
} from "./report-redaction";
import type { MarkdownPdfProjectCodexReportArtifact } from "./types-report";

function publicSummaryPath(runtime: CliRuntime, path: string): string {
  return escapeMdPdfProjectCodexTerminalText(
    publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path),
  );
}

export function formatMdPdfProjectCodexHandoffReview(input: {
  finalProfile: Record<string, unknown>;
  reportArtifact: MarkdownPdfProjectCodexReportArtifact;
}): string[] {
  const profileReview = collectMarkdownPdfProfileAuthoringReview(input.finalProfile);
  const pageNumbers = profileReview.normalizedProfile.pageNumbers;
  const { handoff, phases, project } = input.reportArtifact;
  const templateHtml = input.reportArtifact.files.find((file) => file.role === "template-html");
  const styleCss = input.reportArtifact.files.find((file) => file.role === "style-css");
  const lines = [
    "Contained Profile:",
    `Profile identity: ${handoff.profile.id}`,
    `Profile: ${handoff.profile.bundlePath}`,
    `Profile decision mode: ${phases.profile.decisionMode}`,
    `Effective page numbers: enabled=${pageNumbers.enabled ? "yes" : "no"}, scope=${pageNumbers.scope}, countFrom=${pageNumbers.countFrom}, start=${pageNumbers.start}, increment=${pageNumbers.increment}, position=${pageNumbers.position}, format=${JSON.stringify(sanitizeMdPdfProjectCodexTerminalText(pageNumbers.format))}`,
  ];

  if (handoff.capabilityRequirements.length === 0) {
    lines.push("Capability requirements: none");
  } else {
    lines.push("Capability requirements:");
    for (const requirement of handoff.capabilityRequirements) {
      lines.push(
        `- ${requirement.capabilityId} (minimum ${requirement.minimumVersion}; requested by ${requirement.requestedBy.join(", ")})`,
      );
    }
  }

  lines.push(
    "",
    "Template presentation:",
    `Template decision mode: ${phases.template.decisionMode}`,
    ...(templateHtml?.bundlePath ? [`Template HTML: ${templateHtml.bundlePath}`] : []),
    ...(styleCss?.bundlePath ? [`Stylesheet: ${styleCss.bundlePath}`] : []),
    `Managed assets: ${input.reportArtifact.managedAssets.length}`,
    "",
    "Project orchestration:",
    `Project signal mode: ${project.signalMode}`,
    `Final decision mode: ${project.decisionMode}`,
    `Project artifacts: ${handoff.artifacts.availability}`,
    `Follow-up render usability: ${handoff.render.usability}`,
  );

  if (project.fallbackReason) {
    lines.push(`Fallback reason: ${sanitizeMdPdfProjectCodexTerminalText(project.fallbackReason)}`);
  }
  for (const direction of input.reportArtifact.unsupportedDirections) {
    lines.push(`Unsupported direction: ${sanitizeMdPdfProjectCodexTerminalText(direction)}`);
  }
  for (const result of input.reportArtifact.validationResults.filter(
    (result) => result.status === "failed",
  )) {
    lines.push(`Validation failed: ${result.name}`);
  }
  for (const diagnostic of handoff.diagnostics) {
    lines.push(
      `Project ${diagnostic.severity} [${diagnostic.conditionId}]: ${sanitizeMdPdfProjectCodexTerminalText(diagnostic.message)}`,
    );
  }
  if (handoff.render.usability !== "unavailable") {
    lines.push(
      `Follow-up render: ${escapeMdPdfProjectCodexTerminalText(handoff.render.command.display)}`,
    );
  }
  return lines;
}

export function printMdPdfProjectCodexSummary(
  runtime: CliRuntime,
  input: {
    outputPlan: MarkdownPdfProjectCodexOutputPlan;
    profilePhase: MdPdfProjectCodexProfilePhaseResult;
    reportArtifact: MarkdownPdfProjectCodexReportArtifact;
    state: NormalizedMdPdfProjectCodexCommandState;
  },
): void {
  const noUsableProject = input.reportArtifact.handoff.artifacts.availability === "unavailable";
  for (const line of formatMdPdfProjectCodexHandoffReview({
    finalProfile: input.profilePhase.finalProfile,
    reportArtifact: input.reportArtifact,
  })) {
    printLine(runtime.stdout, line);
  }
  printLine(
    runtime.stdout,
    `Output directory: ${publicSummaryPath(runtime, input.outputPlan.outputDirectory)}`,
  );
  if (!noUsableProject) {
    printLine(runtime.stdout, `Project bundle: ${input.outputPlan.identity.projectBundleId}`);
  }
  if (input.outputPlan.report) {
    printLine(
      runtime.stdout,
      `Codex report: ${publicSummaryPath(runtime, input.outputPlan.report.path)}`,
    );
  }
  if (input.state.dryRun) {
    printLine(runtime.stdout, "Dry run only. No project bundle files were written.");
  }
}
