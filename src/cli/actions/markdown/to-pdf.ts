import { relative } from "node:path";
import {
  type MarkdownPdfCodeHighlighter,
  type MarkdownPdfProcessRunner,
  type MarkdownPdfRenderBundleResolvedInputs,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import type { CliRuntime } from "../../types";
import { displayPath, printLine } from "../shared";
import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  prepareMarkdownPdfRender,
} from "./to-pdf-service";
import { printMarkdownPdfRenderWarnings } from "./render-warnings";

export interface MdToPdfOptions extends NormalizeMarkdownPdfOptionsInput {
  input: string;
  output?: string;
  bundle?: string;
  profile?: string;
  meta?: string[];
  template?: string;
  css?: string;
  noDefaultCss?: boolean;
  htmlOutput?: string;
  codeHighlight?: boolean;
  pageNumbers?: boolean;
  overwrite?: boolean;
  runner?: MarkdownPdfProcessRunner;
  codeHighlighter?: MarkdownPdfCodeHighlighter;
}

function printRenderBundleSummary(input: {
  bundleDirectory: string;
  resolved: MarkdownPdfRenderBundleResolvedInputs;
  runtime: CliRuntime;
}): void {
  printLine(
    input.runtime.stdout,
    `Resolved Markdown PDF bundle: ${displayPath(input.runtime, input.bundleDirectory)}`,
  );
  for (const role of ["profile", "template", "css"] as const) {
    const resolvedInput = input.resolved[role];
    if (!resolvedInput) {
      continue;
    }
    const resolvedPath =
      resolvedInput.source === "bundle"
        ? relative(input.bundleDirectory, resolvedInput.path)
        : displayPath(input.runtime, resolvedInput.path);
    const sourceLabel = resolvedInput.source === "explicit" ? " (explicit)" : "";
    printLine(input.runtime.stdout, `- ${role}: ${resolvedPath}${sourceLabel}`);
  }
}

function printIgnoredRenderBundleFiles(runtime: CliRuntime, ignoredProfileFiles: string[]): void {
  if (ignoredProfileFiles.length === 0) {
    return;
  }
  printLine(runtime.stderr, "Warning: ignored unclassified YAML or JSON bundle files:");
  for (const filename of ignoredProfileFiles) {
    printLine(runtime.stderr, `- ${filename}`);
  }
}

export async function actionMdToPdf(runtime: CliRuntime, options: MdToPdfOptions): Promise<void> {
  const prepared = await prepareMarkdownPdfRender(runtime, options);
  const plan = await planMarkdownPdfRender(runtime, prepared, options);

  if (prepared.bundleDirectory && prepared.resolvedBundle) {
    printIgnoredRenderBundleFiles(runtime, prepared.ignoredBundleProfileFiles);
    printRenderBundleSummary({
      bundleDirectory: prepared.bundleDirectory,
      resolved: prepared.resolvedBundle,
      runtime,
    });
  }

  const result = await executePlannedMarkdownPdfRender(runtime, plan, {
    runner: options.runner,
    codeHighlighter: options.codeHighlighter,
  });

  printMarkdownPdfRenderWarnings(runtime, result.warnings);

  printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, plan.outputPath)}`);
}
