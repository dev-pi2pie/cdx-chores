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
  MarkdownPdfProjectCodexIdentityUidFactory,
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
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory;
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
        identityUidFactory: input.identityUidFactory,
      }),
      generatedOutputDirectory: false,
    };
  }

  for (let attempt = 0; attempt < PROJECT_CODEX_OUTPUT_RETRY_LIMIT; attempt += 1) {
    const identityValues = createMdPdfProjectCodexIdentityValues({
      now,
      attempt,
      identityUidFactory: input.identityUidFactory,
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
  bundlePath?: string;
  parentRootDirectory?: string;
  requireInsideOutputDirectory: boolean;
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
  runtime: CliRuntime,
): ProjectCodexPlannedPathTarget[] {
  return [
    {
      label: "--output",
      path: plan.outputDirectory,
      requireInsideOutputDirectory: false,
      writable: false,
    },
    {
      bundlePath: plan.profile.bundlePath,
      label: "planned profile.yml",
      parentRootDirectory: plan.outputDirectory,
      path: plan.profile.path,
      requireInsideOutputDirectory: true,
      writable: true,
    },
    {
      bundlePath: plan.templateHtml.bundlePath,
      label: "planned template.html",
      parentRootDirectory: plan.outputDirectory,
      path: plan.templateHtml.path,
      requireInsideOutputDirectory: true,
      writable: true,
    },
    {
      bundlePath: plan.styleCss.bundlePath,
      label: "planned style.css",
      parentRootDirectory: plan.outputDirectory,
      path: plan.styleCss.path,
      requireInsideOutputDirectory: true,
      writable: true,
    },
    ...(plan.report
      ? [
          {
            bundlePath: plan.report.location === "in-bundle" ? plan.report.bundlePath : undefined,
            label: "--codex-report-output",
            parentRootDirectory:
              plan.report.location === "in-bundle" ? plan.outputDirectory : runtime.cwd,
            path: plan.report.path,
            requireInsideOutputDirectory: plan.report.location === "in-bundle",
            writable: true,
          },
        ]
      : []),
    ...plan.assets.map((asset) => ({
      bundlePath: asset.bundlePath,
      label: `planned asset ${asset.bundlePath}`,
      parentRootDirectory: plan.outputDirectory,
      path: asset.path,
      requireInsideOutputDirectory: true,
      writable: true,
    })),
  ];
}

function collectPathCollisionPairs(input: {
  plan: MarkdownPdfProjectCodexOutputPlan;
  state: NormalizedMdPdfProjectCodexCommandState;
  runtime: CliRuntime;
}): Array<{
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}> {
  const sourceEntries = collectSourcePathEntries(input.state);
  const plannedEntries = collectPlannedPathTargets(input.plan, input.runtime);

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

export async function validateMdPdfProjectCodexOutputWritability(input: {
  plan: MarkdownPdfProjectCodexOutputPlan;
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
}): Promise<void> {
  await assertUsableProjectCodexOutputDirectory(input.plan.outputDirectory, {
    overwrite: input.state.overwrite,
    parentRootDirectory: input.runtime.cwd,
  });
  const plannedTargets = collectPlannedPathTargets(input.plan, input.runtime);
  for (const target of plannedTargets) {
    if (!target.path || !target.requireInsideOutputDirectory) {
      continue;
    }
    assertPathInsideDirectory({
      directory: input.plan.outputDirectory,
      directoryLabel: "--output",
      path: target.path,
      pathLabel: target.bundlePath ?? target.label,
    });
  }
  await assertDistinctPathPairs(
    collectPathCollisionPairs({
      plan: input.plan,
      runtime: input.runtime,
      state: input.state,
    }),
  );
  await Promise.all(
    plannedTargets
      .filter(
        (target): target is ProjectCodexPlannedPathTarget & { path: string } =>
          target.writable && Boolean(target.path),
      )
      .map((file) =>
        assertWritableProjectCodexPlannedFile(file, {
          label: file.label,
          overwrite: input.state.overwrite,
          parentRootDirectory: file.parentRootDirectory,
        }),
      ),
  );
}

export async function planMdPdfProjectCodexOutput(input: {
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory;
  runtime: CliRuntime;
  state: NormalizedMdPdfProjectCodexCommandState;
  signalMode: MarkdownPdfProjectCodexSignalMode;
}): Promise<MarkdownPdfProjectCodexOutputPlan> {
  assertProceedingSignalMode(input.signalMode);
  const outputResolution = await resolveOutputIdentity({
    identityUidFactory: input.identityUidFactory,
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

  await validateMdPdfProjectCodexOutputWritability({
    plan,
    runtime: input.runtime,
    state: input.state,
  });

  return plan;
}
