import { printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import {
  collectMarkdownPdfProfileAuthoringReview,
  formatMarkdownPdfProfilePageChromeArea,
} from "../profile-authoring-review";
import { escapeMarkdownPdfPageInformationTerminalText } from "../page-information-terminal";
import type { MarkdownPdfPageChromePosition } from "../profile";
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

function safeCodexResultText(value: string): string {
  return escapeMarkdownPdfPageInformationTerminalText(sanitizeMdPdfProjectCodexTerminalText(value));
}

export function formatMdPdfProjectCodexHandoffReview(input: {
  finalProfile: Record<string, unknown>;
  hasExplicitPageInformation?: boolean;
  includeRepeatingContent?: boolean;
  alreadyShownPageNumberLabel?: string;
  alreadyShownRepeatingText?: Partial<Record<MarkdownPdfPageChromePosition, string>>;
  profilePhaseMode?: string;
  templatePhaseMode?: string;
  localDetails?: Pick<
    MarkdownPdfProjectCodexReportArtifact,
    "unsupportedDirections" | "validationResults"
  > & {
    fallbackReason?: string;
    diagnostics: MarkdownPdfProjectCodexReportArtifact["handoff"]["diagnostics"];
  };
  reportArtifact: MarkdownPdfProjectCodexReportArtifact;
}): string[] {
  const profileReview = collectMarkdownPdfProfileAuthoringReview(input.finalProfile);
  const pageNumbers = profileReview.normalizedProfile.pageNumbers;
  const { handoff, phases, project } = input.reportArtifact;
  const templateHtml = input.reportArtifact.files.find((file) => file.role === "template-html");
  const styleCss = input.reportArtifact.files.find((file) => file.role === "style-css");
  const detailText = input.hasExplicitPageInformation
    ? escapeMarkdownPdfPageInformationTerminalText
    : safeCodexResultText;
  const lines = [
    "Contained Profile:",
    `Profile identity: ${handoff.profile.id}`,
    `Profile: ${handoff.profile.bundlePath}`,
    `Profile decision mode: ${phases.profile.decisionMode}`,
    `Effective page numbers: enabled=${pageNumbers.enabled ? "yes" : "no"}, scope=${pageNumbers.scope}, countFrom=${pageNumbers.countFrom}, start=${pageNumbers.start}, increment=${pageNumbers.increment}, position=${pageNumbers.position}, format=${input.alreadyShownPageNumberLabel === pageNumbers.format ? "(matches entered label)" : input.hasExplicitPageInformation ? escapeMarkdownPdfPageInformationTerminalText(JSON.stringify(pageNumbers.format)) : JSON.stringify(sanitizeMdPdfProjectCodexTerminalText(pageNumbers.format))}`,
    ...(input.includeRepeatingContent
      ? [
          "Effective repeating page content:",
          ...formatMarkdownPdfProfilePageChromeArea(
            "Header",
            profileReview.normalizedProfile.header,
            {
              left: input.alreadyShownRepeatingText?.["top-left"],
              center: input.alreadyShownRepeatingText?.["top-center"],
              right: input.alreadyShownRepeatingText?.["top-right"],
            },
          ).map((line) =>
            input.hasExplicitPageInformation
              ? escapeMarkdownPdfPageInformationTerminalText(line)
              : line,
          ),
          ...formatMarkdownPdfProfilePageChromeArea(
            "Footer",
            profileReview.normalizedProfile.footer,
            {
              left: input.alreadyShownRepeatingText?.["bottom-left"],
              center: input.alreadyShownRepeatingText?.["bottom-center"],
              right: input.alreadyShownRepeatingText?.["bottom-right"],
            },
          ).map((line) =>
            input.hasExplicitPageInformation
              ? escapeMarkdownPdfPageInformationTerminalText(line)
              : line,
          ),
        ]
      : []),
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
    ...(input.profilePhaseMode ? [`Profile phase: ${input.profilePhaseMode}`] : []),
    ...(input.templatePhaseMode ? [`Template phase: ${input.templatePhaseMode}`] : []),
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

  const fallbackReason = input.localDetails?.fallbackReason ?? project.fallbackReason;
  if (fallbackReason) {
    lines.push(`Fallback reason: ${detailText(fallbackReason)}`);
  }
  for (const direction of input.localDetails?.unsupportedDirections ??
    input.reportArtifact.unsupportedDirections) {
    lines.push(`Unsupported direction: ${detailText(direction)}`);
  }
  for (const result of (
    input.localDetails?.validationResults ?? input.reportArtifact.validationResults
  ).filter((result) => result.status === "failed")) {
    lines.push(`Validation failed: ${result.name}`);
  }
  for (const diagnostic of input.localDetails?.diagnostics ?? handoff.diagnostics) {
    lines.push(
      `Project ${diagnostic.severity} [${diagnostic.conditionId}]: ${detailText(diagnostic.message)}`,
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
