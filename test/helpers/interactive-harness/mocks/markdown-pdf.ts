import { mock } from "bun:test";
import { extname, resolve } from "node:path";

import { CliError } from "../../../../src/cli/errors";
import type { HarnessRunnerContext } from "../context";
import {
  fontDiscoveryModuleUrl,
  markdownPdfCodexServiceModuleUrl,
  markdownPdfDeterministicAuthoringModuleUrl,
  markdownPdfLifecycleModuleUrl,
  markdownPdfRenderBundleModuleUrl,
  markdownPdfRenderServiceModuleUrl,
} from "../module-urls";

const DEFAULT_OPTIONS = {
  preset: "article",
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: "18mm", right: "18mm", bottom: "18mm", left: "18mm" },
  toc: false,
  tocDepth: 3,
  tocPageBreak: "auto",
};

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

function defaultPdfOutput(inputPath: string): string {
  const extension = extname(inputPath);
  return extension ? `${inputPath.slice(0, -extension.length)}.pdf` : `${inputPath}.pdf`;
}

export function installMarkdownPdfMocks(context: HarnessRunnerContext): void {
  let preparedCount = 0;
  let deterministicPreparedCount = 0;
  let sessionCount = 0;
  const codexPreparedCounts: Record<CodexArtifact, number> = {
    profile: 0,
    "template-bundle": 0,
    "project-bundle": 0,
  };

  mock.module(fontDiscoveryModuleUrl, () => ({
    discoverSystemFonts: async (input: Record<string, unknown>) => {
      const discoveryIndex = context.result.markdownPdfFontDiscoveryCalls.length;
      context.result.markdownPdfFontDiscoveryCalls.push({
        discovery: input.discovery,
        hasSignal: input.signal instanceof AbortSignal,
        timeoutMs: input.timeoutMs,
      });
      if (context.scenario.markdownPdfFontDiscoveryErrorMessage) {
        throw new Error(context.scenario.markdownPdfFontDiscoveryErrorMessage);
      }
      const families =
        context.scenario.markdownPdfFontFamilyRuns?.[discoveryIndex] ??
        context.scenario.markdownPdfFontFamilies ??
        [];
      return {
        adapter: "fontconfig",
        discovery: "fontconfig",
        faces: families.map((family, index) => ({
          family,
          fullName: family,
          path: `/private/font-${index}.otf`,
          source: "system",
          style: "normal",
        })),
        warnings: [],
      };
    },
  }));

  mock.module(markdownPdfLifecycleModuleUrl, () => ({
    createOwnedMarkdownPdfSession: async () => {
      sessionCount += 1;
      const session = {
        path: context.resolveHarnessPath(`.harness-md-pdf-session-${sessionCount}`),
        state: "active",
      };
      context.result.markdownPdfSessionCreateCalls.push(session.path);
      return session;
    },
    assertActiveOwnedMarkdownPdfSession: (session: { state: string }) => {
      if (session.state !== "active") {
        throw new TypeError(`Markdown PDF session is ${session.state}, not active.`);
      }
    },
    retainOwnedMarkdownPdfSession: (session: { path: string; state: string }) => {
      session.state = "retained";
      context.result.markdownPdfSessionRetainCalls.push(session.path);
    },
    cleanupOwnedMarkdownPdfSession: async (session: { path: string; state: string }) => {
      context.result.markdownPdfSessionCleanupCalls.push(session.path);
      if (context.scenario.markdownPdfCleanupErrorMessage) {
        session.state = "retained";
        throw new Error(context.scenario.markdownPdfCleanupErrorMessage);
      }
      session.state = "removed";
      context.recordRemovedPath(session.path);
    },
  }));

  mock.module(markdownPdfCodexServiceModuleUrl, () => ({
    prepareMarkdownPdfCodexCandidate: async (_runtime: unknown, setup: Record<string, unknown>) => {
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
        unusable,
      });
      const prepared =
        artifact === "profile"
          ? unusable
            ? { kind: "no-usable-profile" }
            : {
                decisionMode: "generated",
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
                  reportArtifact: { unsupportedDirections: [] },
                  validation: { decisionMode: unusable ? "no-usable-project" : "generated" },
                },
                layout: {
                  assets: [],
                  profile: { bundlePath: "profile.yml" },
                  styleCss: { bundlePath: "style.css" },
                  templateHtml: { bundlePath: "template.html" },
                },
                profilePhase: {},
                signals: { modes: { project: setup.sample ? "document-informed" : "intent-only" } },
                templatePhase: { synthesis: { fontDecisions: [] } },
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
      context.result.markdownPdfCodexWriteCalls.push({
        artifact: bound.artifact,
        artifactCount: bound.artifactCount,
        candidateId: candidate.candidateId,
        outputFiles: bound.outputFiles,
        outputPath: bound.outputPath,
        overwrite: bound.overwrite,
        report: bound.report,
        suggestedOutput: bound.suggestedOutput,
      });
    },
  }));

  mock.module(markdownPdfDeterministicAuthoringModuleUrl, () => ({
    prepareMarkdownPdfDeterministicRecipe: (input: Record<string, unknown>) => {
      deterministicPreparedCount += 1;
      const candidateId = `deterministic-${deterministicPreparedCount}`;
      context.result.markdownPdfDeterministicPrepareCalls.push({ ...input, candidateId });
      const options = (input.options ?? {}) as Record<string, unknown>;
      const normalizedOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
        margins:
          typeof options.margin === "string"
            ? {
                top: options.margin,
                right: options.margin,
                bottom: options.margin,
                left: options.margin,
              }
            : DEFAULT_OPTIONS.margins,
      };
      return {
        ...input,
        candidateId,
        prepared:
          input.artifact === "profile"
            ? { normalizedOptions, profile: { page: normalizedOptions } }
            : {
                normalizedOptions,
                templateHtml: "<main>$body$</main>",
                styleCss: "body {}",
              },
      };
    },
    bindMarkdownPdfDeterministicRecipeDestination: async (
      _runtime: unknown,
      candidate: Record<string, unknown>,
      input: Record<string, unknown>,
    ) => {
      context.result.markdownPdfDeterministicBindCalls.push({
        ...input,
        artifact: candidate.artifact,
        candidateId: candidate.candidateId,
      });
      if (
        context.scenario.markdownPdfDeterministicBindErrorMessage &&
        context.result.markdownPdfDeterministicBindCalls.length === 1
      ) {
        throw new CliError(context.scenario.markdownPdfDeterministicBindErrorMessage, {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        });
      }
      const outputPath = context.resolveHarnessPath(input.output);
      return candidate.artifact === "profile"
        ? {
            artifact: "profile",
            candidate,
            destination: {
              displayOutputPath: String(input.output),
              outputPath,
              overwrite: input.overwrite,
            },
          }
        : {
            artifact: "template-bundle",
            candidate,
            destination: {
              displayOutputDirectory: String(input.output),
              outputDirectory: outputPath,
              overwrite: input.overwrite,
              templatePath: resolve(outputPath, "template.html"),
              stylePath: resolve(outputPath, "style.css"),
            },
          };
    },
    writeBoundMarkdownPdfDeterministicRecipe: async (bound: Record<string, unknown>) => {
      const candidate = bound.candidate as Record<string, unknown>;
      context.result.markdownPdfDeterministicWriteCalls.push({
        artifact: bound.artifact,
        candidateId: candidate.candidateId,
      });
      const writeError = context.scenario.markdownPdfDeterministicWriteErrorMessages?.shift();
      if (writeError) {
        throw new Error(writeError);
      }
    },
    markdownPdfDeterministicOutputPath: (bound: Record<string, unknown>) => {
      const destination = bound.destination as Record<string, unknown>;
      return String(destination.displayOutputPath ?? destination.displayOutputDirectory);
    },
    markdownPdfDeterministicDestinationPath: (bound: Record<string, unknown>) => {
      const destination = bound.destination as Record<string, unknown>;
      return String(destination.outputPath ?? destination.outputDirectory);
    },
    markdownPdfDeterministicOutputFiles: (bound: Record<string, unknown>) => {
      const destination = bound.destination as Record<string, unknown>;
      return bound.artifact === "profile"
        ? [String(destination.displayOutputPath)]
        : [String(destination.templatePath), String(destination.stylePath)];
    },
  }));

  mock.module(markdownPdfRenderBundleModuleUrl, () => ({
    previewMarkdownPdfRenderBundle: async (directory: string) => {
      context.result.markdownPdfBundleDiscoveryCalls.push({ directory });
      const roles = context.scenario.markdownPdfBundleRoles ?? ["profile", "template", "css"];
      const candidates = (role: "profile" | "template" | "css") =>
        roles.includes(role)
          ? [
              {
                basename:
                  role === "profile"
                    ? "profile.yml"
                    : role === "template"
                      ? "template.html"
                      : "style.css",
                path: resolve(
                  directory,
                  role === "profile"
                    ? "profile.yml"
                    : role === "template"
                      ? "template.html"
                      : "style.css",
                ),
                role,
              },
            ]
          : [];
      return {
        directory,
        profile: candidates("profile"),
        template: candidates("template"),
        css: candidates("css"),
        ignoredProfileFiles: context.scenario.markdownPdfIgnoredBundleFiles ?? [],
      };
    },
  }));

  mock.module(markdownPdfRenderServiceModuleUrl, () => ({
    prepareMarkdownPdfRender: async (_runtime: unknown, input: Record<string, unknown>) => {
      preparedCount += 1;
      const preparedId = `prepared-${preparedCount}`;
      context.result.markdownPdfPrepareCalls.push({ ...input, preparedId });
      const prepareError =
        context.scenario.markdownPdfPrepareErrorMessages?.shift() ??
        context.scenario.markdownPdfPrepareErrorMessage;
      if (prepareError) {
        throw new Error(prepareError);
      }
      const inputPath = context.resolveHarnessPath(input.input);
      const bundleDirectory =
        typeof input.bundle === "string" ? context.resolveHarnessPath(input.bundle) : undefined;
      const rolePath = (role: "profile" | "template" | "css") => {
        const explicit = input[role];
        if (typeof explicit === "string") {
          return { path: context.resolveHarnessPath(explicit), source: "explicit" };
        }
        if (
          bundleDirectory &&
          (context.scenario.markdownPdfBundleRoles ?? ["profile", "template", "css"]).includes(role)
        ) {
          return {
            path: resolve(
              bundleDirectory,
              role === "profile"
                ? "profile.yml"
                : role === "template"
                  ? "template.html"
                  : "style.css",
            ),
            source: "bundle",
          };
        }
        return undefined;
      };
      return {
        __harnessPreparedId: preparedId,
        inputPath,
        bundleDirectory,
        ignoredBundleProfileFiles: context.scenario.markdownPdfIgnoredBundleFiles ?? [],
        resolvedInputs: {
          profile: rolePath("profile"),
          template: rolePath("template"),
          css: rolePath("css"),
        },
        options: DEFAULT_OPTIONS,
        code: {
          highlight: false,
          theme: "github-light",
          lineNumbers: false,
          transformerNotation: false,
        },
        noDefaultCss: false,
        normalizedProfile: {},
        recipe: { templateHtml: "<main>$body$</main>", styleCss: "body {}" },
        titleSignals: { duplicateVisibleTitleRisk: false },
      };
    },
    planMarkdownPdfRender: async (
      _runtime: unknown,
      prepared: Record<string, unknown>,
      input: Record<string, unknown>,
    ) => {
      const outputPath =
        typeof input.output === "string"
          ? context.resolveHarnessPath(input.output)
          : defaultPdfOutput(String(prepared.inputPath));
      context.result.markdownPdfPlanCalls.push({
        ...input,
        outputPath,
        preparedId: prepared.__harnessPreparedId,
      });
      return { prepared, outputPath, overwrite: input.overwrite };
    },
    resolveMarkdownPdfRenderOutput: async (
      _runtime: unknown,
      inputPath: string,
      input: Record<string, unknown>,
    ) => {
      const outputPath =
        typeof input.output === "string"
          ? context.resolveHarnessPath(input.output)
          : defaultPdfOutput(context.resolveHarnessPath(inputPath));
      context.result.markdownPdfPlanCalls.push({
        ...input,
        inputPath,
        outputPath,
        stage: "resolve-output",
      });
      return { outputPath, overwrite: input.overwrite };
    },
    bindResolvedMarkdownPdfRenderOutput: (
      prepared: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => ({ ...output, prepared }),
    executePlannedMarkdownPdfRender: async (_runtime: unknown, plan: Record<string, unknown>) => {
      const prepared = plan.prepared as Record<string, unknown>;
      context.result.markdownPdfExecuteCalls.push({
        outputPath: plan.outputPath,
        preparedId: prepared.__harnessPreparedId,
      });
      const renderError = context.scenario.markdownPdfRenderErrorMessages?.shift();
      if (renderError) {
        throw new Error(renderError);
      }
      return {
        outputPath: plan.outputPath,
        warnings: context.scenario.markdownPdfRenderWarnings ?? [],
      };
    },
  }));
}
