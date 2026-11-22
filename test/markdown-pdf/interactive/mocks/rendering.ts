import { mock } from "bun:test";
import { extname, resolve } from "node:path";

import { CliError } from "../../../../src/cli/errors";
import { DEFAULT_CODE, DEFAULT_OPTIONS, GENERATED_CODE } from "./defaults";

import type { HarnessRunnerContext } from "../../../cli-foundations/interactive-harness/context";
import {
  markdownPdfRenderBundleModuleUrl,
  markdownPdfProjectBundleCompletenessModuleUrl,
  markdownPdfRenderServiceModuleUrl,
} from "../module-urls";

function effectiveCodeOptions(
  profile: typeof DEFAULT_CODE,
  codeHighlight: unknown,
): typeof DEFAULT_CODE {
  if (codeHighlight === false) {
    return {
      ...profile,
      highlight: false,
      lineNumbers: false,
      transformerNotation: false,
    };
  }
  const highlight = codeHighlight === true ? true : profile.highlight;
  return {
    ...profile,
    highlight,
    lineNumbers: highlight ? profile.lineNumbers : false,
    transformerNotation: highlight ? profile.transformerNotation : false,
  };
}

function defaultPdfOutput(inputPath: string): string {
  const extension = extname(inputPath);
  return extension ? `${inputPath.slice(0, -extension.length)}.pdf` : `${inputPath}.pdf`;
}

export function installMarkdownPdfRenderingMocks(context: HarnessRunnerContext): void {
  let preparedCount = 0;

  mock.module(markdownPdfRenderBundleModuleUrl, () => ({
    discoverMarkdownPdfRenderBundle: async () => {
      throw new Error("Unexpected direct render-bundle discovery in the Interactive harness");
    },
    resolveMarkdownPdfRenderBundleInputs: async () => {
      throw new Error("Unexpected direct render-bundle resolution in the Interactive harness");
    },
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

  mock.module(markdownPdfProjectBundleCompletenessModuleUrl, () => ({
    validateMdPdfProjectBundleCompleteness: async (directory: string) => {
      if (context.scenario.markdownPdfProjectCompletenessErrorMessage) {
        throw new Error(context.scenario.markdownPdfProjectCompletenessErrorMessage);
      }
      return {
        assets: [],
        css: resolve(directory, "style.css"),
        directory,
        profile: resolve(directory, "profile.yml"),
        reports: [],
        template: resolve(directory, "template.html"),
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
      const resolvedProfile = rolePath("profile");
      const reusableCode = resolvedProfile ? GENERATED_CODE : DEFAULT_CODE;
      const profilePageNumbersEnabled = resolvedProfile
        ? (context.scenario.markdownPdfProfilePageNumbersEnabled ?? false)
        : false;
      const pageNumberOverride =
        typeof input.pageNumbers === "boolean" ? input.pageNumbers : undefined;
      const effectivePageNumbersEnabled = pageNumberOverride ?? profilePageNumbersEnabled;
      if (context.scenario.markdownPdfNoDefaultCss && effectivePageNumbersEnabled) {
        throw new CliError(
          "Effective page numbers require the generated default stylesheet; remove --no-default-css or disable page numbers for this render.",
          { code: "INVALID_INPUT", exitCode: 2 },
        );
      }
      return {
        __harnessPreparedId: preparedId,
        inputPath,
        bundleDirectory,
        ignoredBundleProfileFiles: context.scenario.markdownPdfIgnoredBundleFiles ?? [],
        resolvedInputs: {
          profile: resolvedProfile,
          template: rolePath("template"),
          css: rolePath("css"),
        },
        options: DEFAULT_OPTIONS,
        code: effectiveCodeOptions(reusableCode, input.codeHighlight),
        noDefaultCss: context.scenario.markdownPdfNoDefaultCss ?? false,
        normalizedProfile: { code: reusableCode },
        pageNumberConfiguration: {
          effective: {
            enabled: effectivePageNumbersEnabled,
            scope: "document",
            countFrom: "document",
            start: 1,
            increment: 1,
            position: "bottom-center",
            format: "{page}",
          },
          ...(pageNumberOverride === undefined ? {} : { override: pageNumberOverride }),
          profileEnabled: profilePageNumbersEnabled,
          source:
            pageNumberOverride === undefined
              ? resolvedProfile
                ? "profile"
                : "default"
              : "direct-override",
        },
        rendererCapabilityRequests: context.scenario.markdownPdfRendererCapabilityRequests ?? [],
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
      const outputError = context.scenario.markdownPdfOutputErrorMessages?.shift();
      if (outputError) {
        throw new CliError(outputError, { code: "OUTPUT_EXISTS", exitCode: 2 });
      }
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
      const outputError = context.scenario.markdownPdfOutputErrorMessages?.shift();
      if (outputError) {
        throw new CliError(outputError, { code: "OUTPUT_EXISTS", exitCode: 2 });
      }
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
        rendererCapabilities: context.scenario.markdownPdfRendererCapabilities ?? {
          renderer: { name: "weasyprint", available: true, version: "69.0" },
          capabilities: [
            {
              id: "pageNumbers.start",
              fields: ["pageNumbers.start"],
              minimumVersion: "65.1",
              status: "satisfied",
            },
          ],
        },
        warnings: context.scenario.markdownPdfRenderWarnings ?? [],
      };
    },
  }));
}
