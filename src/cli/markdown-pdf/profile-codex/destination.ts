import { stat } from "node:fs/promises";
import { extname, join, parse, resolve } from "node:path";

import { CliError } from "../../errors";
import { inferMarkdownPdfProfileFormat } from "../../markdown-pdf";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath } from "../../actions/shared";
import { assertWritableCodexPlannedFile } from "../codex-output-path-policy";

export interface MarkdownPdfProfileCodexDestinationOptions {
  codexReportOutput?: string;
  dryRun?: boolean;
  keepCodexReport?: boolean;
  output?: string;
  overwrite?: boolean;
}

export interface MarkdownPdfProfileCodexDestinationSource {
  baseProfilePath?: string;
  destinationOptions: MarkdownPdfProfileCodexDestinationOptions;
  inputPath?: string;
  profileId: string;
  suggestedOutputPath: string;
}

export interface BoundMarkdownPdfProfileCodexDestination {
  displayOutputPath: string;
  dryRun?: boolean;
  outputPath: string;
  overwrite?: boolean;
  reportOutputPath?: string;
}

function generatedReportPath(profileOutputPath: string, profileId: string): string {
  const parsed = parse(profileOutputPath);
  const stem = parsed.name.includes(profileId) ? parsed.name : `${parsed.name}-${profileId}`;
  return join(parsed.dir, `${stem}-codex-report.json`);
}

function samePath(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && resolve(left) === resolve(right));
}

async function existingPathIdentity(
  path: string | undefined,
): Promise<{ dev: number; ino: number } | undefined> {
  if (!path) {
    return undefined;
  }
  try {
    const stats = await stat(path);
    return { dev: stats.dev, ino: stats.ino };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function assertDifferentPaths(input: {
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}): void {
  if (!samePath(input.left, input.right)) {
    return;
  }
  throw new CliError(`${input.leftLabel} cannot be the same path as ${input.rightLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

async function assertDifferentExistingFiles(input: {
  left: string | undefined;
  leftLabel: string;
  right: string | undefined;
  rightLabel: string;
}): Promise<void> {
  const [leftIdentity, rightIdentity] = await Promise.all([
    existingPathIdentity(input.left),
    existingPathIdentity(input.right),
  ]);
  if (!leftIdentity || !rightIdentity) {
    return;
  }
  if (leftIdentity.dev !== rightIdentity.dev || leftIdentity.ino !== rightIdentity.ino) {
    return;
  }
  throw new CliError(`${input.leftLabel} cannot be the same file as ${input.rightLabel}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export async function bindMarkdownPdfProfileCodexDestination(
  runtime: CliRuntime,
  source: MarkdownPdfProfileCodexDestinationSource,
  overrides: MarkdownPdfProfileCodexDestinationOptions = {},
): Promise<BoundMarkdownPdfProfileCodexDestination> {
  const options = { ...source.destinationOptions, ...overrides };
  const outputPath =
    overrides.output !== undefined
      ? resolveFromCwd(runtime, assertNonEmpty(overrides.output, "Output path"))
      : source.suggestedOutputPath;
  const reportOutputPath = options.codexReportOutput
    ? resolveFromCwd(runtime, options.codexReportOutput)
    : options.keepCodexReport
      ? generatedReportPath(outputPath, source.profileId)
      : undefined;

  inferMarkdownPdfProfileFormat(outputPath);
  if (reportOutputPath && extname(reportOutputPath).toLowerCase() !== ".json") {
    throw new CliError("Markdown PDF Codex report path must end with .json.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const pathCollisionPairs = [
    {
      left: reportOutputPath,
      leftLabel: "--codex-report-output",
      right: outputPath,
      rightLabel: "--output",
    },
    {
      left: outputPath,
      leftLabel: "--output",
      right: source.inputPath,
      rightLabel: "Markdown input",
    },
    {
      left: reportOutputPath,
      leftLabel: "--codex-report-output",
      right: source.inputPath,
      rightLabel: "Markdown input",
    },
    {
      left: outputPath,
      leftLabel: "--output",
      right: source.baseProfilePath,
      rightLabel: "--base-profile",
    },
    {
      left: reportOutputPath,
      leftLabel: "--codex-report-output",
      right: source.baseProfilePath,
      rightLabel: "--base-profile",
    },
    {
      left: source.inputPath,
      leftLabel: "Markdown input",
      right: source.baseProfilePath,
      rightLabel: "--base-profile",
    },
  ];
  for (const pair of pathCollisionPairs) {
    assertDifferentPaths(pair);
  }
  if (!options.dryRun) {
    await assertWritableCodexPlannedFile(
      { path: outputPath },
      { label: "--output", overwrite: options.overwrite, parentRootDirectory: runtime.cwd },
    );
  }
  if (reportOutputPath) {
    await assertWritableCodexPlannedFile(
      { path: reportOutputPath },
      {
        label: "--codex-report-output",
        overwrite: options.overwrite,
        parentRootDirectory: runtime.cwd,
      },
    );
  }
  for (const pair of pathCollisionPairs) {
    await assertDifferentExistingFiles(pair);
  }

  return {
    displayOutputPath: displayPath(runtime, outputPath),
    dryRun: options.dryRun,
    outputPath,
    overwrite: options.overwrite,
    reportOutputPath,
  };
}
