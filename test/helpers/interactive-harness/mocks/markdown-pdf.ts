import { mock } from "bun:test";
import { extname, resolve } from "node:path";

import type { HarnessRunnerContext } from "../context";
import {
  markdownPdfDeterministicAuthoringModuleUrl,
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

function defaultPdfOutput(inputPath: string): string {
  const extension = extname(inputPath);
  return extension ? `${inputPath.slice(0, -extension.length)}.pdf` : `${inputPath}.pdf`;
}

export function installMarkdownPdfMocks(context: HarnessRunnerContext): void {
  let preparedCount = 0;
  let deterministicPreparedCount = 0;

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
      if (context.scenario.markdownPdfDeterministicBindErrorMessage) {
        throw new Error(context.scenario.markdownPdfDeterministicBindErrorMessage);
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
    },
    markdownPdfDeterministicOutputPath: (bound: Record<string, unknown>) => {
      const destination = bound.destination as Record<string, unknown>;
      return String(destination.displayOutputPath ?? destination.displayOutputDirectory);
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
      if (context.scenario.markdownPdfPrepareErrorMessage) {
        throw new Error(context.scenario.markdownPdfPrepareErrorMessage);
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
    executePlannedMarkdownPdfRender: async (_runtime: unknown, plan: Record<string, unknown>) => {
      const prepared = plan.prepared as Record<string, unknown>;
      context.result.markdownPdfExecuteCalls.push({
        outputPath: plan.outputPath,
        preparedId: prepared.__harnessPreparedId,
      });
      return {
        outputPath: plan.outputPath,
        warnings: context.scenario.markdownPdfRenderWarnings ?? [],
      };
    },
  }));
}
