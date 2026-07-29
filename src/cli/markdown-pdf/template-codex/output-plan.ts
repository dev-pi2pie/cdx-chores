import { stat } from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";

import { isNotFoundError } from "../../actions/markdown/common";
import { assertNonEmpty } from "../../actions/shared";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { createMdPdfTemplateCodexBundleId } from "./identity";
import {
  assertDistinctPathPairs,
  assertPathInsideDirectory,
  assertUsableTemplateCodexOutputDirectory,
  assertWritableTemplateCodexPlannedFile,
} from "./path-collisions";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexPlannedAsset,
  MarkdownPdfTemplateCodexPlannedFile,
  MarkdownPdfTemplateCodexPlannedReport,
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

const TEMPLATE_CODEX_OUTPUT_RETRY_LIMIT = 10;
const TEMPLATE_HTML_BUNDLE_PATH = "template.html";
const STYLE_CSS_BUNDLE_PATH = "style.css";
export const MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_BUNDLE_PATH = "template.codex-report.json";

export type MdPdfTemplateCodexOutputWriteMode = "bundle" | "report-only";

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

function generatedTemplateOutputDirectory(input: {
  bundleId: string;
  runtime: CliRuntime;
}): string {
  return join(input.runtime.cwd, input.bundleId);
}

function plannedBundleFile(
  outputDirectory: string,
  bundlePath: string,
): MarkdownPdfTemplateCodexPlannedFile {
  return {
    path: join(outputDirectory, bundlePath),
    bundlePath,
  };
}

function plannedReportFile(
  outputDirectory: string,
  state: NormalizedMdPdfTemplateCodexCommandState,
): MarkdownPdfTemplateCodexPlannedReport | undefined {
  if (!state.keepCodexReport) {
    return undefined;
  }
  if (state.codexReportOutputPath) {
    return {
      path: state.codexReportOutputPath,
      location: "external",
    };
  }
  return {
    ...plannedBundleFile(outputDirectory, MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_BUNDLE_PATH),
    location: "in-bundle",
  };
}

function sanitizeAssetStem(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return assertNonEmpty(sanitized || "cover", "Asset filename");
}

function plannedCoverAsset(
  outputDirectory: string,
  sourcePath: string,
): MarkdownPdfTemplateCodexPlannedAsset {
  const parsed = parse(basename(sourcePath));
  const extension = (parsed.ext || extname(sourcePath)).toLowerCase();
  const sourceBasename = basename(sourcePath);
  const fileName = `${sanitizeAssetStem(parsed.name)}${extension}`;
  const bundlePath = `assets/${fileName}`;
  return {
    path: join(outputDirectory, "assets", fileName),
    bundlePath,
    role: "cover-image",
    sourcePath,
    sourceBasename,
  };
}

async function resolveOutputDirectory(input: {
  runtime: CliRuntime;
  state: NormalizedMdPdfTemplateCodexCommandState;
}): Promise<{ bundleId: string; generatedOutputDirectory: boolean; outputDirectory: string }> {
  const now = input.runtime.now();
  if (input.state.outputPath) {
    return {
      bundleId: createMdPdfTemplateCodexBundleId(now, 0, input.state.templateBundleIdFactory),
      generatedOutputDirectory: false,
      outputDirectory: input.state.outputPath,
    };
  }

  for (let attempt = 0; attempt < TEMPLATE_CODEX_OUTPUT_RETRY_LIMIT; attempt += 1) {
    const bundleId = createMdPdfTemplateCodexBundleId(
      now,
      attempt,
      input.state.templateBundleIdFactory,
    );
    const outputDirectory = generatedTemplateOutputDirectory({
      bundleId,
      runtime: input.runtime,
    });
    if (!(await pathExists(outputDirectory))) {
      return {
        bundleId,
        generatedOutputDirectory: true,
        outputDirectory,
      };
    }
  }

  throw new CliError("Unable to generate a non-colliding Markdown PDF template directory.", {
    code: "OUTPUT_EXISTS",
    exitCode: 2,
  });
}

interface TemplateCodexCollisionEntry {
  label: string;
  path: string | undefined;
}

function pairwiseCollisionPairs(entries: TemplateCodexCollisionEntry[]): Array<{
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}> {
  return entries.flatMap((left, leftIndex) =>
    entries.slice(leftIndex + 1).map((right) => ({
      left: left.path,
      leftLabel: left.label,
      right: right.path,
      rightLabel: right.label,
    })),
  );
}

function collectPathCollisionPairs(input: {
  plan: MarkdownPdfTemplateCodexOutputPlan;
  state: NormalizedMdPdfTemplateCodexCommandState;
  writeMode: MdPdfTemplateCodexOutputWriteMode;
}): Array<{
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}> {
  const sourceEntries: TemplateCodexCollisionEntry[] = [
    {
      label: "Markdown input",
      path: input.state.inputPath,
    },
    {
      label: "--base-profile",
      path: input.state.baseProfilePath,
    },
    {
      label: "--cover-image",
      path: input.state.coverImagePath,
    },
  ];
  const plannedEntries: TemplateCodexCollisionEntry[] =
    input.writeMode === "bundle"
      ? [
          {
            label: "--output",
            path: input.plan.outputDirectory,
          },
          {
            label: "planned template.html",
            path: input.plan.templateHtml.path,
          },
          {
            label: "planned style.css",
            path: input.plan.styleCss.path,
          },
        ]
      : [
          {
            label: "--output",
            path: input.plan.outputDirectory,
          },
        ];

  if (input.plan.report) {
    plannedEntries.push({
      label: "--codex-report-output",
      path: input.plan.report.path,
    });
  }

  if (input.writeMode === "bundle") {
    for (const asset of input.plan.assets) {
      plannedEntries.push({
        label: `planned asset ${asset.bundlePath}`,
        path: asset.path,
      });
    }
  }

  return [
    ...pairwiseCollisionPairs(sourceEntries),
    ...plannedEntries.flatMap((planned) =>
      sourceEntries.map((source) => ({
        left: planned.path,
        leftLabel: planned.label,
        right: source.path,
        rightLabel: source.label,
      })),
    ),
    ...pairwiseCollisionPairs(plannedEntries),
  ];
}

function writablePlannedFiles(input: {
  plan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  writeMode: MdPdfTemplateCodexOutputWriteMode;
}): Array<{ label: string; parentRootDirectory?: string; path: string }> {
  if (input.writeMode === "report-only") {
    return input.plan.report
      ? [
          {
            label: "--codex-report-output",
            parentRootDirectory:
              input.plan.report.location === "in-bundle"
                ? input.plan.outputDirectory
                : input.runtime.cwd,
            path: input.plan.report.path,
          },
        ]
      : [];
  }
  return [
    {
      label: "planned template.html",
      parentRootDirectory: input.plan.outputDirectory,
      path: input.plan.templateHtml.path,
    },
    {
      label: "planned style.css",
      parentRootDirectory: input.plan.outputDirectory,
      path: input.plan.styleCss.path,
    },
    ...(input.plan.report
      ? [
          {
            label: "--codex-report-output",
            parentRootDirectory:
              input.plan.report.location === "in-bundle"
                ? input.plan.outputDirectory
                : input.runtime.cwd,
            path: input.plan.report.path,
          },
        ]
      : []),
    ...input.plan.assets.map((asset) => ({
      label: `planned asset ${asset.bundlePath}`,
      parentRootDirectory: input.plan.outputDirectory,
      path: asset.path,
    })),
  ];
}

export async function validateMdPdfTemplateCodexOutputWritability(input: {
  plan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  state: NormalizedMdPdfTemplateCodexCommandState;
  writeMode: MdPdfTemplateCodexOutputWriteMode;
}): Promise<void> {
  await assertUsableTemplateCodexOutputDirectory(input.plan.outputDirectory, {
    allowExistingContents: input.writeMode === "report-only",
    overwrite: input.state.overwrite,
    parentRootDirectory: input.runtime.cwd,
  });
  await assertDistinctPathPairs(
    collectPathCollisionPairs({
      plan: input.plan,
      state: input.state,
      writeMode: input.writeMode,
    }),
  );
  await Promise.all(
    writablePlannedFiles({
      plan: input.plan,
      runtime: input.runtime,
      writeMode: input.writeMode,
    }).map((file) =>
      assertWritableTemplateCodexPlannedFile(file, {
        label: file.label,
        overwrite: input.state.overwrite,
        parentRootDirectory: file.parentRootDirectory,
      }),
    ),
  );
}

export async function planMdPdfTemplateCodexOutput(input: {
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  writeMode?: MdPdfTemplateCodexOutputWriteMode;
}): Promise<MarkdownPdfTemplateCodexOutputPlan> {
  const outputResolution = await resolveOutputDirectory({
    runtime: input.runtime,
    state: input.state,
  });

  const plan: MarkdownPdfTemplateCodexOutputPlan = {
    bundleId: outputResolution.bundleId,
    outputDirectory: outputResolution.outputDirectory,
    generatedOutputDirectory: outputResolution.generatedOutputDirectory,
    templateHtml: plannedBundleFile(outputResolution.outputDirectory, TEMPLATE_HTML_BUNDLE_PATH),
    styleCss: plannedBundleFile(outputResolution.outputDirectory, STYLE_CSS_BUNDLE_PATH),
    report: plannedReportFile(outputResolution.outputDirectory, input.state),
    assets:
      input.signals.coverImage.available && input.state.coverImagePath
        ? [plannedCoverAsset(outputResolution.outputDirectory, input.state.coverImagePath)]
        : [],
  };

  for (const file of [plan.templateHtml, plan.styleCss, ...plan.assets]) {
    if (file) {
      assertPathInsideDirectory({
        directory: plan.outputDirectory,
        directoryLabel: "--output",
        path: file.path,
        pathLabel: file.bundlePath ?? file.path,
      });
    }
  }
  if (plan.report?.location === "in-bundle") {
    assertPathInsideDirectory({
      directory: plan.outputDirectory,
      directoryLabel: "--output",
      path: plan.report.path,
      pathLabel: plan.report.bundlePath,
    });
  }

  await validateMdPdfTemplateCodexOutputWritability({
    plan,
    runtime: input.runtime,
    state: input.state,
    writeMode: input.writeMode ?? "bundle",
  });

  return plan;
}
