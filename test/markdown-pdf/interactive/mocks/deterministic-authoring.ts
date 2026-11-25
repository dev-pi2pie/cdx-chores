import { mock } from "bun:test";
import { resolve } from "node:path";

import { CliError } from "../../../../src/cli/errors";
import { MARKDOWN_PDF_PROFILE_CURRENT_REVISION } from "../../../../src/cli/markdown-pdf/profile/feature-registry";
import { DEFAULT_CODE, DEFAULT_OPTIONS } from "./defaults";

import type { HarnessRunnerContext } from "../../../cli-foundations/interactive-harness/context";
import { markdownPdfDeterministicAuthoringModuleUrl } from "../module-urls";

export function installMarkdownPdfDeterministicAuthoringMock(context: HarnessRunnerContext): void {
  let deterministicPreparedCount = 0;

  mock.module(markdownPdfDeterministicAuthoringModuleUrl, () => ({
    prepareMarkdownPdfDeterministicRecipe: (input: Record<string, unknown>) => {
      deterministicPreparedCount += 1;
      const candidateId = `deterministic-${deterministicPreparedCount}`;
      context.result.markdownPdfDeterministicPrepareCalls.push({ ...input, candidateId });
      const options = (input.options ?? {}) as Record<string, unknown>;
      const formalGuideAnswers = (input.formalGuideAnswers ?? {}) as Record<string, unknown>;
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
            ? {
                normalizedOptions,
                profile: {
                  schemaVersion: MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
                  code: formalGuideAnswers.code ?? DEFAULT_CODE,
                  ...(formalGuideAnswers.pageChrome as Record<string, unknown> | undefined),
                  ...(formalGuideAnswers.pageNumbers
                    ? { pageNumbers: formalGuideAnswers.pageNumbers }
                    : {}),
                  page: {
                    size: normalizedOptions.pageSize,
                    orientation: normalizedOptions.orientation,
                    marginTop: normalizedOptions.margins.top,
                    marginRight: normalizedOptions.margins.right,
                    marginBottom: normalizedOptions.margins.bottom,
                    marginLeft: normalizedOptions.margins.left,
                  },
                  toc: {
                    enabled: normalizedOptions.toc,
                    depth: normalizedOptions.tocDepth,
                    pageBreak: normalizedOptions.tocPageBreak,
                  },
                },
              }
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
}
