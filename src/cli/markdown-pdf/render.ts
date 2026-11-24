import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse as parsePath } from "node:path";

import { requireCommandMinimumVersion } from "../deps";
import { CliError } from "../errors";
import { readTextFileRequired, writeBufferFileSafe, writeTextFileSafe } from "../file-io";
import { execCommand, type ExecCommandResult } from "../process";
import { highlightMarkdownPdfCodeBlocks } from "./code-highlight";
import { finalizeMarkdownPdfPageNumberHtml } from "./page-number-html";
import { inspectPrintedTitle } from "./title/printed-proof";
import { resolveStyledTitle } from "./title/styled-title";
import {
  resolveMarkdownPdfPandocSource,
  runMarkdownPdfPandocStage,
  type MarkdownPdfAstTitleTemplate,
} from "./pandoc-source";
import {
  createMarkdownPdfCoverHtml,
  createMarkdownPdfCoverScaffold,
  MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER,
  type EffectiveMarkdownPdfCodeOptions,
  type NormalizedMarkdownPdfPageNumbers,
  type NormalizedMarkdownPdfProfile,
} from "./profile";
import { MARKDOWN_PDF_COVER_STYLES } from "./profile/feature-registry";
import {
  assessMarkdownPdfRendererCapabilities,
  assertMarkdownPdfRendererCapabilities,
  requireMarkdownPdfRenderer,
  type MarkdownPdfRendererCapabilityAssessment,
  type MarkdownPdfRendererCapabilityRequest,
} from "./renderer-capabilities";
import {
  inspectMarkdownPdfProtocolAllowlist,
  MARKDOWN_PDF_PROTOCOL_ALLOWLIST_OPTION,
  MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION,
} from "./requirements";
import {
  rejectRemoteMarkdownPdfAssetsWhenDisabled,
  rewriteMarkdownPdfTemplateLocalAssets,
} from "./template-assets";
import {
  isManagedMarkdownPdfTemplate,
  type MarkdownPdfTemplateCompatibilityResult,
} from "./template-compatibility";
import type { NormalizedMarkdownPdfOptions } from "./validation";

export type MarkdownPdfProcessRunner = typeof execCommand;
export type MarkdownPdfCodeHighlighter = typeof highlightMarkdownPdfCodeBlocks;

export interface RenderMarkdownPdfInput {
  bodyBoundary: MarkdownPdfTemplateCompatibilityResult["bodyBoundary"];
  inputPath: string;
  outputPath: string;
  templateHtml: string;
  templateForAstTitle?: MarkdownPdfAstTitleTemplate;
  defaultCss?: string;
  customTemplatePath?: string;
  customCssPath?: string;
  noDefaultCss?: boolean;
  htmlOutputPath?: string;
  overwrite?: boolean;
  options: NormalizedMarkdownPdfOptions;
  pageNumbers: NormalizedMarkdownPdfPageNumbers;
  profile?: NormalizedMarkdownPdfProfile;
  code?: EffectiveMarkdownPdfCodeOptions;
  platform?: NodeJS.Platform;
  rendererCapabilityRequests?: readonly MarkdownPdfRendererCapabilityRequest[];
  runner?: MarkdownPdfProcessRunner;
  codeHighlighter?: MarkdownPdfCodeHighlighter;
}

export interface RenderMarkdownPdfResult {
  pandoc: ExecCommandResult;
  weasyprint: ExecCommandResult;
  warnings: string[];
  rendererCapabilities: MarkdownPdfRendererCapabilityAssessment;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resourceFailureCounts(stderr: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of splitLines(stderr)) {
    if (/^(?:ERROR|WARNING): (?:Failed to load\b|Font-face .+ cannot be loaded\b)/u.test(line)) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  return counts;
}

function formatProcessFailure(
  command: string,
  result: ExecCommandResult,
  precedingWarnings: string[] = [],
): CliError {
  const failure = `${command} failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`;
  return new CliError([...precedingWarnings, failure.trim()].join("\n"), {
    code: "PROCESS_FAILED",
    exitCode: 1,
  });
}

async function createTempFile(dir: string, name: string, content: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

async function createFinalHtml(
  input: RenderMarkdownPdfInput,
  pandocHtmlPath: string,
): Promise<string> {
  const pandocHtml = await readTextFileRequired(pandocHtmlPath);
  const highlightedHtml = input.code?.highlight
    ? await (input.codeHighlighter ?? highlightMarkdownPdfCodeBlocks)(pandocHtml, input.code)
    : pandocHtml;
  return finalizeMarkdownPdfPageNumberHtml({
    bodyBoundary: input.bodyBoundary,
    html: highlightedHtml,
    pageNumbers: input.pageNumbers,
  });
}

async function createCustomTemplateRenderFile(input: {
  sourcePath: string;
  tempDir: string;
  profile?: NormalizedMarkdownPdfProfile;
}): Promise<string> {
  const templateHtml = await readTextFileRequired(input.sourcePath);
  const resolvedTemplate = resolveManagedProfileTextCover({
    templateHtml,
    profile: input.profile,
  });
  return await createTempFile(
    input.tempDir,
    "template.html",
    await rewriteMarkdownPdfTemplateLocalAssets(resolvedTemplate, dirname(input.sourcePath)),
  );
}

function resolveManagedProfileTextCover(input: {
  templateHtml: string;
  profile?: NormalizedMarkdownPdfProfile;
}): string {
  if (!input.templateHtml.includes(MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER)) {
    return input.templateHtml;
  }
  const profile = input.profile;
  const markerCount = input.templateHtml.split(MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER).length - 1;
  const matchingScaffolds = profile?.cover.enabled
    ? MARKDOWN_PDF_COVER_STYLES.map((style) =>
        createMarkdownPdfCoverScaffold({
          ...profile,
          cover: { ...profile.cover, style },
        }),
      ).filter((scaffold) => input.templateHtml.includes(scaffold))
    : [];
  if (
    markerCount !== 1 ||
    matchingScaffolds.length !== 1 ||
    !isManagedMarkdownPdfTemplate(input.templateHtml) ||
    !profile?.cover.enabled
  ) {
    throw new CliError("Managed text cover does not match the enabled Profile cover.", {
      code: "MARKDOWN_PDF_COVER_BOUNDARY_REQUIRED",
      exitCode: 2,
    });
  }
  return input.templateHtml.replace(matchingScaffolds[0]!, () =>
    createMarkdownPdfCoverHtml(profile),
  );
}

export async function renderMarkdownPdf(
  input: RenderMarkdownPdfInput,
): Promise<RenderMarkdownPdfResult> {
  const runner = input.runner ?? execCommand;
  const cwd = dirname(input.inputPath);
  const requests = input.rendererCapabilityRequests ?? [];
  const renderer = await requireMarkdownPdfRenderer(
    requests,
    input.platform ?? process.platform,
    (command, args) => runner(command, args, { cwd }),
  );
  const rendererCapabilities = assessMarkdownPdfRendererCapabilities({ renderer });
  assertMarkdownPdfRendererCapabilities({ assessment: rendererCapabilities, requests });
  if (!input.options.allowRemoteAssets) {
    requireCommandMinimumVersion(
      renderer,
      MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION,
      "Markdown PDF rendering with remote assets disabled",
    );
  }

  const tempDir = await mkdtemp(join(tmpdir(), "cdx-chores-md-pdf-"));
  try {
    const source = await resolveMarkdownPdfPandocSource({
      inputPath: input.inputPath,
      cwd,
      tempDir,
      templateHtml: input.templateHtml,
      templateForAstTitle: input.templateForAstTitle,
      customStyle: Boolean(input.customCssPath),
      runner,
    });
    const templatePath = input.customTemplatePath
      ? await createCustomTemplateRenderFile({
          sourcePath: input.customTemplatePath,
          tempDir,
          profile: input.profile,
        })
      : await createTempFile(tempDir, "template.html", source.templateHtml);
    const defaultCssPath =
      input.noDefaultCss || !input.defaultCss
        ? undefined
        : await createTempFile(tempDir, "style.css", input.defaultCss);
    const pandocHtmlPath = join(tempDir, `${basename(input.inputPath)}.pandoc.html`);
    const finalHtmlPath = join(tempDir, `${basename(input.inputPath)}.render.html`);
    const cssPaths = [defaultCssPath, input.customCssPath].filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );

    const pandocArgs = [
      source.path,
      "--standalone",
      "--from",
      source.format,
      "--to",
      "html",
      "--template",
      templatePath,
      "--output",
      pandocHtmlPath,
    ];
    if (input.options.toc) {
      pandocArgs.push("--toc", "--toc-depth", String(input.options.tocDepth));
    }

    const pandoc =
      source.format === "json"
        ? await runMarkdownPdfPandocStage(
            runner,
            "HTML writer",
            pandocArgs,
            cwd,
            source.readerStderr,
          )
        : await runner("pandoc", pandocArgs, { cwd });
    if (!pandoc.ok) {
      throw formatProcessFailure("pandoc", pandoc);
    }
    const pandocWarnings = [...splitLines(source.readerStderr), ...splitLines(pandoc.stderr)];

    let html = await createFinalHtml(input, pandocHtmlPath);

    await rejectRemoteMarkdownPdfAssetsWhenDisabled({
      html,
      cssPaths,
      htmlBaseDirectory: cwd,
      allowRemoteAssets: input.options.allowRemoteAssets,
      htmlCssAdditionalRootDirectories: input.customTemplatePath
        ? [dirname(input.customTemplatePath)]
        : [],
    });

    const weasyprintArgs = ["--base-url", cwd];
    if (!input.options.allowRemoteAssets) {
      if (!(await inspectMarkdownPdfProtocolAllowlist(runner, cwd))) {
        throw new CliError(
          `Markdown PDF rendering with remote assets disabled requires WeasyPrint ${MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION} or newer with ${MARKDOWN_PDF_PROTOCOL_ALLOWLIST_OPTION} support.`,
          { code: "MARKDOWN_PDF_ASSET_POLICY_UNSUPPORTED", exitCode: 2 },
        );
      }
      weasyprintArgs.push(MARKDOWN_PDF_PROTOCOL_ALLOWLIST_OPTION, "file,data");
    }

    for (const cssPath of cssPaths) {
      weasyprintArgs.push("--stylesheet", cssPath);
    }
    const renderedPdfPath = join(tempDir, "rendered.pdf");
    const printPdf = async (htmlPath: string, path: string, tagged = false) => ({
      path,
      result: await runner(
        "weasyprint",
        [...weasyprintArgs, ...(tagged ? ["--pdf-tags"] : []), htmlPath, path],
        { cwd },
      ),
    });
    const printed = new Map<string, Awaited<ReturnType<typeof printPdf>>>();
    if (source.styledTitle) {
      html = await resolveStyledTitle({
        ...source.styledTitle,
        html,
        customStyle: Boolean(input.customCssPath),
        inspect: async (probe, candidates) => {
          // Capture the ordinary output before optional inspection can consume a
          // one-shot asset. Both decisions then publish already-rendered bytes.
          const fallbackHtml = await createTempFile(tempDir, "title-fallback.html", html);
          const fallback = await printPdf(fallbackHtml, renderedPdfPath);
          printed.set(html, fallback);
          if (!fallback.result.ok) return {};
          const fallbackFailures = resourceFailureCounts(fallback.result.stderr);
          return inspectPrintedTitle(
            probe,
            tempDir,
            async (probeHtml, probePdf) => {
              const output = await printPdf(probeHtml, probePdf, true);
              // Different font faces can produce identical warnings. Compare
              // each proof with the ordinary render independently.
              if (
                !output.result.ok ||
                [...resourceFailureCounts(output.result.stderr)].some(
                  ([line, count]) => count > (fallbackFailures.get(line) ?? 0),
                )
              ) {
                return false;
              }
              if (!printed.has(probe)) printed.set(probe, output);
              return true;
            },
            candidates,
          );
        },
      });
    }
    await writeFile(finalHtmlPath, html, "utf8");
    if (input.htmlOutputPath) {
      await writeTextFileSafe(input.htmlOutputPath, html, {
        label: "HTML output",
        overwrite: input.overwrite,
        parentRootDirectory: parsePath(input.htmlOutputPath).root,
      });
    }

    const { path: selectedPdf, result: weasyprint } =
      printed.get(html) ?? (await printPdf(finalHtmlPath, renderedPdfPath));
    if (!weasyprint.ok) {
      throw formatProcessFailure(
        "weasyprint",
        weasyprint,
        source.format === "json" ? pandocWarnings : [],
      );
    }
    await writeBufferFileSafe(input.outputPath, await readFile(selectedPdf), {
      label: "PDF output",
      overwrite: input.overwrite,
      parentRootDirectory: parsePath(input.outputPath).root,
    });

    return {
      pandoc,
      weasyprint,
      warnings: [...pandocWarnings, ...splitLines(weasyprint.stderr)],
      rendererCapabilities,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
