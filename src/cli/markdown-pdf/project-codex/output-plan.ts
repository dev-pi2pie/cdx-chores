import { stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { isNotFoundError } from "../../actions/markdown/common";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import {
  assertDistinctPathPairs,
  assertPathInsideDirectory,
} from "../template-codex/path-collisions";
import { createMdPdfProjectCodexIdentity, createMdPdfProjectCodexIdentityValues } from "./identity";
import {
  assertUsableProjectCodexOutputDirectory,
  assertWritableProjectCodexPlannedFile,
} from "./path-collisions";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexPlannedAsset,
  MarkdownPdfProjectCodexPlannedFile,
  MarkdownPdfProjectCodexPlannedIdentity,
  MarkdownPdfProjectCodexPlannedReport,
  MarkdownPdfProjectCodexProceedingSignalMode,
  MarkdownPdfProjectCodexSignalMode,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";

const PROJECT_CODEX_OUTPUT_RETRY_LIMIT = 10;
const PROFILE_BUNDLE_PATH = "profile.yml";
const TEMPLATE_HTML_BUNDLE_PATH = "template.html";
const STYLE_CSS_BUNDLE_PATH = "style.css";
const DEFAULT_REPORT_BUNDLE_PATH = "project.codex-report.json";

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

function generatedProjectOutputDirectory(input: {
  projectBundleId: string;
  runtime: CliRuntime;
}): string {
  return join(input.runtime.cwd, input.projectBundleId);
}

function plannedBundleFile(
  outputDirectory: string,
  bundlePath: string,
): MarkdownPdfProjectCodexPlannedFile {
  return {
    path: join(outputDirectory, bundlePath),
    bundlePath,
  };
}

function plannedReportFile(
  outputDirectory: string,
  state: NormalizedMdPdfProjectCodexCommandState,
): MarkdownPdfProjectCodexPlannedReport | undefined {
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

function coverAssetBundlePath(sourcePath: string): string {
  const extension = extname(sourcePath).toLowerCase() || ".png";
  return `assets/cover${extension}`;
}

function plannedCoverAsset(
  outputDirectory: string,
  sourcePath: string,
): MarkdownPdfProjectCodexPlannedAsset {
  const bundlePath = coverAssetBundlePath(sourcePath);
  return {
    path: join(outputDirectory, bundlePath),
    bundlePath,
    role: "cover-image",
    sourcePath,
    sourceBasename: basename(sourcePath),
  };
}

function assertProceedingSignalMode(
  signalMode: MarkdownPdfProjectCodexSignalMode,
): asserts signalMode is MarkdownPdfProjectCodexProceedingSignalMode {
  if (signalMode !== "too-low-signal") {
    return;
  }
  throw new CliError(
    "Cannot plan Markdown PDF project output before project signal classification succeeds.",
    {
      code: "MARKDOWN_PDF_PROJECT_LOW_SIGNAL",
      exitCode: 2,
    },
  );
}

async function resolveOutputIdentity(input: {
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Promise<{
  identity: MarkdownPdfProjectCodexPlannedIdentity;
  generatedOutputDirectory: boolean;
}> {
  const now = input.runtime.now();
  if (input.state.outputDirectory) {
    const outputDirectory = input.state.outputDirectory;
    return {
      identity: createMdPdfProjectCodexIdentity({
        now,
        attempt: 0,
        outputDirectory,
        identityUidFactory: input.state.identityUidFactory,
      }),
      generatedOutputDirectory: false,
    };
  }

  for (let attempt = 0; attempt < PROJECT_CODEX_OUTPUT_RETRY_LIMIT; attempt += 1) {
    const identityValues = createMdPdfProjectCodexIdentityValues({
      now,
      attempt,
      identityUidFactory: input.state.identityUidFactory,
    });
    const outputDirectory = generatedProjectOutputDirectory({
      projectBundleId: identityValues.projectBundleId,
      runtime: input.runtime,
    });
    if (!(await pathExists(outputDirectory))) {
      return {
        identity: {
          ...identityValues,
          outputDirectory,
        },
        generatedOutputDirectory: true,
      };
    }
  }

  throw new CliError("Unable to generate a non-colliding Markdown PDF project directory.", {
    code: "OUTPUT_EXISTS",
    exitCode: 2,
  });
}

interface ProjectCodexPathEntry {
  label: string;
  path: string | undefined;
}

interface ProjectCodexPlannedPathTarget extends ProjectCodexPathEntry {
  writable: boolean;
}

function pairwiseCollisionPairs(entries: ProjectCodexPathEntry[]): Array<{
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

function collectSourcePathEntries(
  state: NormalizedMdPdfProjectCodexCommandState,
): ProjectCodexPathEntry[] {
  return [
    {
      label: "Markdown input",
      path: state.inputPath,
    },
    {
      label: "--base-profile",
      path: state.baseProfilePath,
    },
    {
      label: "--cover-image",
      path: state.coverImagePath,
    },
  ];
}

function collectPlannedPathTargets(
  plan: MarkdownPdfProjectCodexOutputPlan,
): ProjectCodexPlannedPathTarget[] {
  return [
    {
      label: "--output",
      path: plan.outputDirectory,
      writable: false,
    },
    {
      label: "planned profile.yml",
      path: plan.profile.path,
      writable: true,
    },
    {
      label: "planned template.html",
      path: plan.templateHtml.path,
      writable: true,
    },
    {
      label: "planned style.css",
      path: plan.styleCss.path,
      writable: true,
    },
    ...(plan.report
      ? [
          {
            label: "--codex-report-output",
            path: plan.report.path,
            writable: true,
          },
        ]
      : []),
    ...plan.assets.map((asset) => ({
      label: `planned asset ${asset.bundlePath}`,
      path: asset.path,
      writable: true,
    })),
  ];
}

function collectPathCollisionPairs(input: {
  plan: MarkdownPdfProjectCodexOutputPlan;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Array<{
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}> {
  const sourceEntries = collectSourcePathEntries(input.state);
  const plannedEntries = collectPlannedPathTargets(input.plan);

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

function writablePlannedFiles(plan: MarkdownPdfProjectCodexOutputPlan): Array<{
  label: string;
  path: string;
}> {
  return collectPlannedPathTargets(plan).filter(
    (target): target is ProjectCodexPlannedPathTarget & { path: string } =>
      target.writable && Boolean(target.path),
  );
}

export async function validateMdPdfProjectCodexOutputWritability(input: {
  plan: MarkdownPdfProjectCodexOutputPlan;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Promise<void> {
  await assertUsableProjectCodexOutputDirectory(input.plan.outputDirectory, {
    overwrite: input.state.overwrite,
  });
  await assertDistinctPathPairs(
    collectPathCollisionPairs({
      plan: input.plan,
      state: input.state,
    }),
  );
  await Promise.all(
    writablePlannedFiles(input.plan).map((file) =>
      assertWritableProjectCodexPlannedFile(file, {
        label: file.label,
        overwrite: input.state.overwrite,
      }),
    ),
  );
}

export async function planMdPdfProjectCodexOutput(input: {
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
  signalMode: MarkdownPdfProjectCodexSignalMode;
}): Promise<MarkdownPdfProjectCodexOutputPlan> {
  assertProceedingSignalMode(input.signalMode);
  const outputResolution = await resolveOutputIdentity({
    runtime: input.runtime,
    state: input.state,
  });
  const outputDirectory = outputResolution.identity.outputDirectory;
  const plan: MarkdownPdfProjectCodexOutputPlan = {
    identity: outputResolution.identity,
    outputDirectory,
    generatedOutputDirectory: outputResolution.generatedOutputDirectory,
    profile: plannedBundleFile(outputDirectory, PROFILE_BUNDLE_PATH),
    templateHtml: plannedBundleFile(outputDirectory, TEMPLATE_HTML_BUNDLE_PATH),
    styleCss: plannedBundleFile(outputDirectory, STYLE_CSS_BUNDLE_PATH),
    report: plannedReportFile(outputDirectory, input.state),
    assets: input.state.coverImagePath
      ? [plannedCoverAsset(outputDirectory, input.state.coverImagePath)]
      : [],
  };

  for (const file of [plan.profile, plan.templateHtml, plan.styleCss, ...plan.assets]) {
    assertPathInsideDirectory({
      directory: plan.outputDirectory,
      directoryLabel: "--output",
      path: file.path,
      pathLabel: file.bundlePath,
    });
  }
  if (plan.report?.location === "in-bundle") {
    assertPathInsideDirectory({
      directory: plan.outputDirectory,
      directoryLabel: "--output",
      path: plan.report.path,
      pathLabel: plan.report.bundlePath,
    });
  }

  await validateMdPdfProjectCodexOutputWritability({
    plan,
    state: input.state,
  });

  return plan;
}
