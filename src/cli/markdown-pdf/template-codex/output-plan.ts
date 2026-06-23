import { lstat, stat } from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";

import { CliError } from "../../errors";
import { isNotFoundError } from "../../actions/markdown/common";
import { assertNonEmpty } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { createMdPdfTemplateCodexBundleId } from "./identity";
import {
  assertDistinctPathPairs,
  assertPathInsideDirectory,
  assertUsableTemplateCodexOutputDirectory,
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
const DEFAULT_REPORT_BUNDLE_PATH = "template.codex-report.json";

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

async function assertWritablePlannedFile(
  file: { path: string },
  options: { label: string; overwrite?: boolean },
): Promise<void> {
  try {
    const stats = await lstat(file.path);
    if (stats.isSymbolicLink()) {
      throw new CliError(
        `${options.label} is a symlink and cannot be written safely: ${file.path}`,
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
        },
      );
    }
    if (stats.isDirectory()) {
      throw new CliError(`${options.label} is a directory: ${file.path}`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (!options.overwrite) {
      throw new CliError(
        `${options.label} already exists: ${file.path}. Use --overwrite to replace it.`,
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
        },
      );
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to inspect ${options.label}: ${file.path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }
}

function generatedTemplateOutputDirectory(input: {
  bundleId: string;
  inputPath?: string;
  runtime: CliRuntime;
}): string {
  if (!input.inputPath) {
    return join(input.runtime.cwd, input.bundleId);
  }
  const parsed = parse(input.inputPath);
  return join(parsed.dir, `${parsed.name}.pdf-template-${input.bundleId}`);
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
    ...plannedBundleFile(outputDirectory, DEFAULT_REPORT_BUNDLE_PATH),
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
      inputPath: input.state.inputPath,
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
  const plannedEntries: TemplateCodexCollisionEntry[] = [
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
  ];

  if (input.plan.report) {
    plannedEntries.push({
      label: "--codex-report-output",
      path: input.plan.report.path,
    });
  }

  for (const asset of input.plan.assets) {
    plannedEntries.push({
      label: `planned asset ${asset.bundlePath}`,
      path: asset.path,
    });
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

export async function planMdPdfTemplateCodexOutput(input: {
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
}): Promise<MarkdownPdfTemplateCodexOutputPlan> {
  const outputResolution = await resolveOutputDirectory({
    runtime: input.runtime,
    state: input.state,
  });
  await assertUsableTemplateCodexOutputDirectory(outputResolution.outputDirectory, {
    overwrite: input.state.overwrite,
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

  await assertDistinctPathPairs(collectPathCollisionPairs({ plan, state: input.state }));
  await Promise.all([
    assertWritablePlannedFile(plan.templateHtml, {
      label: "planned template.html",
      overwrite: input.state.overwrite,
    }),
    assertWritablePlannedFile(plan.styleCss, {
      label: "planned style.css",
      overwrite: input.state.overwrite,
    }),
    ...(plan.report
      ? [
          assertWritablePlannedFile(plan.report, {
            label: "--codex-report-output",
            overwrite: input.state.overwrite,
          }),
        ]
      : []),
    ...plan.assets.map((asset) =>
      assertWritablePlannedFile(asset, {
        label: `planned asset ${asset.bundlePath}`,
        overwrite: input.state.overwrite,
      }),
    ),
  ]);

  return plan;
}
