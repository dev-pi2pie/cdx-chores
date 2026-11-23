import { mock } from "bun:test";
import { resolve } from "node:path";

import { CliError } from "../../../../src/cli/errors";
import { MarkdownPdfPageInformationConflictError } from "../../../../src/cli/markdown-pdf/profile-codex";
import { GENERATED_CODE } from "./defaults";

import type { HarnessRunnerContext } from "../../../cli-foundations/interactive-harness/context";
import { markdownPdfCodexServiceModuleUrl } from "../module-urls";

type CodexArtifact = "profile" | "template-bundle" | "project-bundle";

const CODEX_ARTIFACT_FILE_NAMES: Record<CodexArtifact, string[]> = {
  profile: ["profile.yml"],
  "template-bundle": ["template.html", "style.css"],
  "project-bundle": ["profile.yml", "template.html", "style.css"],
};

function codexOutputFiles(artifact: CodexArtifact, output: string, report: unknown): string[] {
  const files =
    artifact === "profile"
      ? [output]
      : CODEX_ARTIFACT_FILE_NAMES[artifact].map((file) => resolve(output, file));
  if (typeof report === "object" && report !== null) {
    const reportRecord = report as Record<string, unknown>;
    if (reportRecord.kind === "external") {
      files.push(String(reportRecord.path));
    } else if (reportRecord.kind === "with-artifact") {
      files.push(
        artifact === "profile"
          ? `${output}.codex-report.json`
          : resolve(output, "codex-report.json"),
      );
    }
  }
  return files;
}

export function installMarkdownPdfCodexAuthoringMock(context: HarnessRunnerContext): void {
  const codexPreparedCounts: Record<CodexArtifact, number> = {
    profile: 0,
    "template-bundle": 0,
    "project-bundle": 0,
  };

  mock.module(markdownPdfCodexServiceModuleUrl, () => ({
    prepareMarkdownPdfCodexCandidate: async (
      _runtime: unknown,
      setup: Record<string, unknown>,
      options: { timeoutMs?: number; codexExecution?: unknown } = {},
    ) => {
      const artifact = setup.artifact as CodexArtifact;
      codexPreparedCounts[artifact] += 1;
      const artifactCount = codexPreparedCounts[artifact];
      const candidateId = `codex-${artifact}-${artifactCount}`;
      const suggestedOutput =
        artifact === "profile" ? `generated/${candidateId}.yml` : `generated/${candidateId}`;
      const unusable =
        context.scenario.markdownPdfCodexUnusableArtifacts?.includes(artifact) ?? false;
      context.result.markdownPdfCodexPrepareCalls.push({
        ...setup,
        artifactCount,
        candidateId,
        suggestedOutput,
        timeoutMs: options.timeoutMs,
        ...(context.scenario.codexExecution || context.scenario.captureCodexExecution
          ? { codexExecution: options.codexExecution }
          : {}),
        unusable,
      });
      if (
        context.scenario.markdownPdfCodexPrepareCoverConflictOnCall ===
        context.result.markdownPdfCodexPrepareCalls.length
      ) {
        throw new CliError("Cover intent conflicts with the selected Profile.", {
          code: "MARKDOWN_PDF_PROJECT_COVER_CONFLICT",
          exitCode: 2,
        });
      }
      const conflict =
        context.scenario.markdownPdfCodexPrepareConflicts?.[
          context.result.markdownPdfCodexPrepareCalls.length - 1
        ];
      if (conflict) throw new MarkdownPdfPageInformationConflictError(conflict);
      const prepared =
        artifact === "profile"
          ? unusable
            ? { kind: "no-usable-profile" }
            : {
                decisionMode: "generated",
                finalProfile: context.scenario.markdownPdfCodexFinalProfile ?? {
                  code: GENERATED_CODE,
                },
                kind: "profile",
                signalMode: setup.sample ? "document-informed" : "intent-only",
                suggestedOutputPath: suggestedOutput,
              }
          : artifact === "template-bundle"
            ? {
                outputPlan: {
                  assets: [],
                  outputDirectory: suggestedOutput,
                  styleCss: {
                    bundlePath: "style.css",
                    path: resolve(suggestedOutput, "style.css"),
                  },
                  templateHtml: {
                    bundlePath: "template.html",
                    path: resolve(suggestedOutput, "template.html"),
                  },
                },
                signals: { signalMode: setup.sample ? "document-informed" : "intent-only" },
                synthesis: {
                  decisionMode: unusable ? "no-usable-template" : "generated",
                  fontDecisions: [],
                  unsupportedDirections: [],
                },
              }
            : {
                binding: {
                  outputPlan: {
                    assets: [],
                    outputDirectory: suggestedOutput,
                    profile: { path: resolve(suggestedOutput, "profile.yml") },
                    styleCss: { path: resolve(suggestedOutput, "style.css") },
                    templateHtml: { path: resolve(suggestedOutput, "template.html") },
                  },
                  reportArtifact: {
                    handoff: context.scenario.markdownPdfCodexProjectHandoff ?? {
                      profile: {
                        id: "md-pdf-profile-20260101T000000Z-abc12345",
                        bundlePath: "profile.yml",
                      },
                      artifacts: { availability: unusable ? "unavailable" : "planned" },
                      render: unusable
                        ? { usability: "unavailable" }
                        : {
                            usability: "planned",
                            command: {
                              executable: "cdx-chores",
                              args: [
                                "md",
                                "to-pdf",
                                "--input",
                                "fixtures/report.md",
                                "--bundle",
                                suggestedOutput,
                                "--output",
                                "<output.pdf>",
                              ],
                              display: `cdx-chores 'md' 'to-pdf' '--input' 'fixtures/report.md' '--bundle' '${suggestedOutput}' '--output' '<output.pdf>'`,
                            },
                          },
                      diagnostics: [],
                      capabilityRequirements: [],
                    },
                    managedAssets: [],
                    files: unusable
                      ? []
                      : [
                          { role: "profile", bundlePath: "profile.yml", planned: true },
                          {
                            role: "template-html",
                            bundlePath: "template.html",
                            planned: true,
                          },
                          { role: "style-css", bundlePath: "style.css", planned: true },
                        ],
                    phases: {
                      profile: { decisionMode: "generated" },
                      template: { decisionMode: "generated" },
                    },
                    project: {
                      decisionMode: unusable ? "no-usable-project" : "generated",
                      signalMode: setup.sample ? "document-informed" : "intent-only",
                    },
                    unsupportedDirections: [],
                    validationResults: [{ name: "profile-normalization", status: "passed" }],
                  },
                  validation: {
                    decisionMode: unusable ? "no-usable-project" : "generated",
                    diagnostics: {
                      conditions: Array.isArray(
                        context.scenario.markdownPdfCodexProjectHandoff?.diagnostics,
                      )
                        ? context.scenario.markdownPdfCodexProjectHandoff.diagnostics
                        : [],
                    },
                    results: [{ name: "profile-normalization", status: "passed" }],
                  },
                },
                layout: {
                  assets: [],
                  profile: { bundlePath: "profile.yml" },
                  styleCss: { bundlePath: "style.css" },
                  templateHtml: { bundlePath: "template.html" },
                },
                profilePhase: {
                  finalProfile: context.scenario.markdownPdfCodexFinalProfile ?? {
                    code: GENERATED_CODE,
                  },
                  phase: {
                    decisionMode: "generated",
                    signalMode: setup.sample ? "document-informed" : "hint-only",
                    warnings: [],
                  },
                  unmatchedProfileDirections: [],
                },
                signals: { modes: { project: setup.sample ? "document-informed" : "intent-only" } },
                templatePhase: {
                  phase: { decisionMode: "generated", signalMode: "deterministic", warnings: [] },
                  forwardedProfileDirections: [],
                  synthesis: { fontDecisions: [], unsupportedDirections: [] },
                },
              };
      return { artifact, artifactCount, candidateId, prepared, setup, suggestedOutput };
    },
    suggestedMarkdownPdfCodexOutputPath: (candidate: Record<string, unknown>) => {
      const candidateId = String(candidate.candidateId);
      return candidate.artifact === "profile"
        ? `generated/${candidateId}.yml`
        : `generated/${candidateId}`;
    },
    bindMarkdownPdfCodexCandidate: async (
      _runtime: unknown,
      candidate: Record<string, unknown>,
      input: Record<string, unknown>,
    ) => {
      const artifact = candidate.artifact as CodexArtifact;
      const outputPath = String(input.output);
      const outputFiles = codexOutputFiles(artifact, outputPath, input.report);
      context.result.markdownPdfCodexBindCalls.push({
        artifact,
        artifactCount: candidate.artifactCount,
        candidateId: candidate.candidateId,
        output: input.output,
        outputFiles,
        outputPath,
        overwrite: input.overwrite,
        report: input.report,
        suggestedOutput: candidate.suggestedOutput,
      });
      if (
        context.scenario.markdownPdfCodexBindErrorMessage &&
        context.result.markdownPdfCodexBindCalls.length === 1
      ) {
        throw new CliError(context.scenario.markdownPdfCodexBindErrorMessage, {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        });
      }
      return {
        artifact,
        artifactCount: candidate.artifactCount,
        candidate,
        outputFiles,
        outputPath,
        overwrite: input.overwrite,
        report: input.report,
        suggestedOutput: candidate.suggestedOutput,
      };
    },
    boundMarkdownPdfCodexOutputPath: (bound: Record<string, unknown>) => bound.outputPath,
    boundMarkdownPdfCodexOutputFiles: (bound: Record<string, unknown>) => bound.outputFiles,
    writeBoundMarkdownPdfCodexCandidate: async (
      _runtime: unknown,
      bound: Record<string, unknown>,
    ) => {
      const candidate = bound.candidate as Record<string, unknown>;
      const prepared = candidate.prepared as Record<string, unknown>;
      const savedProfile =
        bound.artifact === "profile"
          ? prepared.finalProfile
          : bound.artifact === "project-bundle"
            ? (prepared.profilePhase as Record<string, unknown>).finalProfile
            : undefined;
      context.result.markdownPdfCodexWriteCalls.push({
        artifact: bound.artifact,
        artifactCount: bound.artifactCount,
        candidateId: candidate.candidateId,
        outputFiles: bound.outputFiles,
        outputPath: bound.outputPath,
        overwrite: bound.overwrite,
        report: bound.report,
        suggestedOutput: bound.suggestedOutput,
        ...(savedProfile ? { savedProfile: structuredClone(savedProfile) } : {}),
      });
    },
  }));
}
