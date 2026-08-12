import { createMarkdownPdfCodexReportArtifact } from "../../markdown-pdf/codex-report";
import { writeMarkdownPdfCodexReportArtifact } from "../../markdown-pdf/codex-report";
import { CliError } from "../../errors";
import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import { displayPath, printLine } from "../../actions/shared";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import {
  collectMarkdownPdfProfileAuthoringReview,
  formatMarkdownPdfProfileAuthoringReview,
} from "../profile-authoring-review";
import type { BoundMarkdownPdfProfileCodexDestination } from "./destination";
import type { PreparedMarkdownPdfProfileCodex } from "./prepare";
import { serializeMarkdownPdfProfileCodexProfile } from "./write-profile";

function persistedReportPath(runtime: CliRuntime, path: string): string {
  return publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

function printMarkdownPdfProfileAuthoringSummary(input: {
  finalProfile: Record<string, unknown>;
  runtime: CliRuntime;
}): void {
  const profileFields = { ...input.finalProfile };
  delete profileFields.profile;
  const review = collectMarkdownPdfProfileAuthoringReview(profileFields);
  for (const line of formatMarkdownPdfProfileAuthoringReview(review)) {
    printLine(input.runtime.stdout, line);
  }
}

async function writeReportIfRequested(input: {
  destination: BoundMarkdownPdfProfileCodexDestination;
  prepared: PreparedMarkdownPdfProfileCodex;
  runtime: CliRuntime;
}): Promise<void> {
  if (!input.destination.reportOutputPath) {
    return;
  }
  await writeMarkdownPdfCodexReportArtifact(
    input.destination.reportOutputPath,
    createMarkdownPdfCodexReportArtifact({
      ...input.prepared.reportPayload,
      displayProfileOutputPath: persistedReportPath(input.runtime, input.destination.outputPath),
    }),
    {
      overwrite: input.destination.overwrite,
      parentRootDirectory: input.runtime.cwd,
    },
  );
  printLine(
    input.runtime.stderr,
    `Wrote Codex report: ${displayPath(input.runtime, input.destination.reportOutputPath)}`,
  );
}

export async function commitPreparedMarkdownPdfProfileCodex(input: {
  destination: BoundMarkdownPdfProfileCodexDestination;
  prepared: PreparedMarkdownPdfProfileCodex;
  runtime: CliRuntime;
}): Promise<void> {
  const { destination, prepared, runtime } = input;
  if (prepared.kind !== "profile") {
    await writeReportIfRequested(input);
    throw new CliError(prepared.failureMessage, {
      code:
        prepared.kind === "no-usable-profile"
          ? "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE"
          : "MARKDOWN_PDF_CODEX_FAILED",
      exitCode: 1,
    });
  }

  if (prepared.signalMode) {
    printLine(runtime.stdout, `Signal mode: ${prepared.signalMode}`);
  }
  printLine(runtime.stdout, `Decision: ${prepared.decisionMode}`);
  printLine(runtime.stdout, `Based on: ${prepared.identity.basedOn ?? "none"}`);
  if (prepared.identity.preset) {
    printLine(runtime.stdout, `Preset: ${prepared.identity.preset}`);
  }
  if (prepared.result?.decision.fallbackReason) {
    printLine(runtime.stdout, `Fallback reason: ${prepared.result.decision.fallbackReason}`);
  }
  printLine(runtime.stdout, `Profile: ${destination.displayOutputPath}`);
  printMarkdownPdfProfileAuthoringSummary({ finalProfile: prepared.finalProfile, runtime });

  if (destination.dryRun) {
    printLine(runtime.stdout, "Dry run only. No profile was written.");
  } else {
    await writeTextFileSafe(
      destination.outputPath,
      serializeMarkdownPdfProfileCodexProfile({
        finalProfile: prepared.finalProfile,
        outputPath: destination.outputPath,
      }),
      { overwrite: destination.overwrite, parentRootDirectory: runtime.cwd },
    );
    printLine(runtime.stderr, `Wrote Markdown PDF profile: ${destination.displayOutputPath}`);
  }

  await writeReportIfRequested(input);
}
