import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { CliError } from "../../errors";
import { writeBufferFileSafe, writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import { validateMdPdfProjectCodexReportWritability } from "./output-plan";
import { assertProjectCodexBundlePathInsideOutput } from "./path-collisions";
import { writeMdPdfProjectCodexReportArtifact } from "./report";
import { sanitizeMdPdfProjectCodexReportText } from "./report-redaction";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexPlannedAsset,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type { MdPdfProjectCodexTemplatePhaseResult } from "./template-phase";
import type { MarkdownPdfProjectCodexValidationSummary } from "./validate-project";

function publicProjectWritePath(runtime: CliRuntime): (path: string) => string {
  return (path) => publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code
  );
}

async function readManagedAssetSource(asset: MarkdownPdfProjectCodexPlannedAsset): Promise<Buffer> {
  let handle;
  try {
    handle = await open(asset.sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new CliError(`managed asset ${asset.bundlePath} source path is not a file.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isNodeErrorCode(error, "ENOENT")) {
      throw new CliError(`managed asset ${asset.bundlePath} source file not found.`, {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
      });
    }
    if (isNodeErrorCode(error, "ELOOP")) {
      throw new CliError(
        `managed asset ${asset.bundlePath} source is a symlink and cannot be copied safely.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Failed to read managed asset ${asset.bundlePath}: ${sanitizeMdPdfProjectCodexReportText(
        message,
      )}`,
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
      },
    );
  } finally {
    await handle?.close();
  }
}

async function copyMdPdfProjectCodexManagedAssets(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  overwrite?: boolean;
  runtime: CliRuntime;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}): Promise<void> {
  const acceptedBundlePaths = new Set(
    input.templatePhase.synthesis.managedAssets.map((asset) => asset.bundlePath),
  );
  for (const asset of input.outputPlan.assets.filter((asset) =>
    acceptedBundlePaths.has(asset.bundlePath),
  )) {
    assertProjectCodexBundlePathInsideOutput({
      bundlePath: asset.bundlePath,
      outputDirectory: input.outputPlan.outputDirectory,
      path: asset.path,
      pathLabel: `managed asset ${asset.bundlePath}`,
    });
    const content = await readManagedAssetSource(asset);
    await writeBufferFileSafe(asset.path, content, {
      displayPath: publicProjectWritePath(input.runtime),
      label: `managed asset ${asset.bundlePath}`,
      overwrite: input.overwrite,
      parentRootDirectory: input.outputPlan.outputDirectory,
      sanitizeMessage: sanitizeMdPdfProjectCodexReportText,
    });
  }
}

export async function writeMdPdfProjectCodexReportIfRequested(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  overwrite?: boolean;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): Promise<void> {
  if (!input.outputPlan.report) {
    return;
  }
  await validateMdPdfProjectCodexReportWritability({
    plan: input.outputPlan,
    runtime: input.runtime,
    state: input.state,
  });
  await writeMdPdfProjectCodexReportArtifact(input);
}

export async function writeMdPdfProjectCodexBundle(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  overwrite?: boolean;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): Promise<void> {
  if (input.validation.decisionMode === "no-usable-project") {
    await writeMdPdfProjectCodexReportIfRequested(input);
    return;
  }

  await writeMdPdfProjectCodexReportIfRequested(input);
  await writeTextFileSafe(input.outputPlan.profile.path, input.profilePhase.serializedProfile, {
    displayPath: publicProjectWritePath(input.runtime),
    label: "planned profile.yml",
    overwrite: input.overwrite,
    parentRootDirectory: input.outputPlan.outputDirectory,
    sanitizeMessage: sanitizeMdPdfProjectCodexReportText,
  });
  await writeTextFileSafe(
    input.outputPlan.templateHtml.path,
    input.templatePhase.synthesis.templateHtml,
    {
      displayPath: publicProjectWritePath(input.runtime),
      label: "planned template.html",
      overwrite: input.overwrite,
      parentRootDirectory: input.outputPlan.outputDirectory,
      sanitizeMessage: sanitizeMdPdfProjectCodexReportText,
    },
  );
  await writeTextFileSafe(input.outputPlan.styleCss.path, input.templatePhase.synthesis.styleCss, {
    displayPath: publicProjectWritePath(input.runtime),
    label: "planned style.css",
    overwrite: input.overwrite,
    parentRootDirectory: input.outputPlan.outputDirectory,
    sanitizeMessage: sanitizeMdPdfProjectCodexReportText,
  });
  await copyMdPdfProjectCodexManagedAssets({
    outputPlan: input.outputPlan,
    overwrite: input.overwrite,
    runtime: input.runtime,
    templatePhase: input.templatePhase,
  });
}
