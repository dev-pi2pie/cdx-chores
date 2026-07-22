import { confirm, select } from "@inquirer/prompts";
import { isAbsolute, relative, resolve } from "node:path";

import {
  bindResolvedMarkdownPdfRenderOutput,
  executePlannedMarkdownPdfRender,
  prepareMarkdownPdfRender,
  resolveMarkdownPdfRenderOutput,
  type PlannedMarkdownPdfRender,
  type ResolvedMarkdownPdfRenderOutput,
} from "../../actions/markdown/to-pdf-service";
import { displayPath, printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import { MARKDOWN_PDF_CODEX_ARTIFACT_LABELS } from "./codex-review";
import { suggestedMarkdownPdfCodexOutputPath } from "./codex-service";
import type {
  MarkdownPdfCodexReportRetention,
  MarkdownPdfGeneratedLifecycleSelection,
} from "./codex-types";
import {
  cleanupOwnedMarkdownPdfSession,
  createOwnedMarkdownPdfSession,
  retainOwnedMarkdownPdfSession,
  type OwnedMarkdownPdfSession,
} from "./lifecycle";
import {
  bindPreparedMarkdownPdfGeneratedCandidate,
  writeBoundMarkdownPdfGeneratedCandidate,
  type BoundMarkdownPdfGeneratedMaterialization,
} from "./materialization";

type GeneratedLifecycleOutcome = "complete" | "review";
type ArtifactDestinationOutcome =
  | { kind: "destination"; output: string; overwrite: boolean }
  | { kind: "review" }
  | { kind: "cancel" };
type PdfOutputOutcome =
  | { kind: "output"; output: ResolvedMarkdownPdfRenderOutput }
  | { kind: "review" }
  | { kind: "cancel" };

const RECOVERABLE_BIND_CODES = new Set([
  "FILE_READ_ERROR",
  "FILE_WRITE_ERROR",
  "INVALID_INPUT",
  "OUTPUT_EXISTS",
  "OUTPUT_SYMLINK",
]);

function artifactLabel(selection: MarkdownPdfGeneratedLifecycleSelection): string {
  return MARKDOWN_PDF_CODEX_ARTIFACT_LABELS[selection.candidate.candidate.artifact];
}

function isWithin(root: string, path: string): boolean {
  const child = relative(resolve(root), resolve(path));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function assertPdfOutputDoesNotCollide(
  runtime: CliRuntime,
  pdfOutput: string,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
  report: MarkdownPdfCodexReportRetention,
): void {
  const resolvedPdf = resolve(pdfOutput);
  if (materialization.outputFiles.some((file) => resolve(file) === resolvedPdf)) {
    throw new CliError("PDF output must be different from generated recipe and report files.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (report.kind === "external" && resolve(runtime.cwd, report.path) === resolvedPdf) {
    throw new CliError("PDF output must be different from the Codex report path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (materialization.kind === "temporary" && isWithin(materialization.session.path, resolvedPdf)) {
    throw new CliError("PDF output must be outside the temporary recipe session.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}

async function promptArtifactDestination(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfGeneratedLifecycleSelection,
): Promise<ArtifactDestinationOutcome> {
  const candidate = selection.candidate;
  let output: string;
  if (candidate.kind === "deterministic") {
    const action = await select<"custom" | "review" | "cancel">({
      message: `${artifactLabel(selection)} output destination`,
      choices: [
        { name: "Choose output", value: "custom" },
        { name: "Back to recipe review", value: "review" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (action !== "custom") {
      return { kind: action };
    }
    output = await promptRequiredPathWithConfig(
      candidate.candidate.artifact === "profile"
        ? "Profile output file"
        : "Template output directory",
      {
        kind: candidate.candidate.artifact === "profile" ? "file" : "directory",
        ...pathPromptContext,
      },
    );
  } else {
    const explicit = candidate.candidate.setup.outputPreference;
    const action = await select<"suggested" | "custom" | "review" | "cancel">({
      message: `${artifactLabel(selection)} output destination`,
      choices: [
        {
          name: explicit ? "Use setup output" : "Use generated output",
          value: "suggested",
          description: explicit
            ? displayPath(runtime, explicit)
            : "Resolve a non-conflicting destination",
        },
        { name: "Custom output", value: "custom" },
        { name: "Back to recipe review", value: "review" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (action === "review" || action === "cancel") {
      return { kind: action };
    }
    output =
      action === "custom"
        ? await promptRequiredPathWithConfig(
            candidate.candidate.artifact === "profile"
              ? "Profile output file"
              : "Bundle output directory",
            {
              kind: candidate.candidate.artifact === "profile" ? "file" : "directory",
              ...pathPromptContext,
            },
          )
        : (explicit ?? (await suggestedMarkdownPdfCodexOutputPath(candidate.candidate)));
  }
  const overwrite = await confirm({
    message: "Overwrite recipe output if it exists?",
    default: false,
  });
  return { kind: "destination", output, overwrite };
}

async function promptGeneratedPdfOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  inputPath: string,
): Promise<PdfOutputOutcome> {
  const destination = await select<"default" | "custom" | "review" | "cancel">({
    message: "PDF output destination",
    choices: [
      { name: "Use default output", value: "default" },
      { name: "Custom output path", value: "custom" },
      { name: "Back to recipe review", value: "review" },
      { name: "Cancel", value: "cancel" },
    ],
  });
  if (destination === "review" || destination === "cancel") {
    return { kind: destination };
  }
  const output =
    destination === "custom"
      ? await promptRequiredPathWithConfig("Custom PDF output path", {
          kind: "file",
          ...pathPromptContext,
        })
      : undefined;
  const overwrite = await confirm({ message: "Overwrite PDF if it exists?", default: false });
  return {
    kind: "output",
    output: await resolveMarkdownPdfRenderOutput(runtime, inputPath, { output, overwrite }),
  };
}

function renderGeneratedFinalReview(
  runtime: CliRuntime,
  selection: MarkdownPdfGeneratedLifecycleSelection,
  pdf: ResolvedMarkdownPdfRenderOutput,
  materialization?: BoundMarkdownPdfGeneratedMaterialization,
): void {
  printLine(runtime.stderr, "Final render review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Input: ${displayPath(runtime, selection.markdownInput)}`);
  printLine(runtime.stderr, `Artifact: ${artifactLabel(selection)}`);
  printLine(
    runtime.stderr,
    selection.lifecycle === "temporary-render"
      ? "Recipe output: CLI-owned temporary session"
      : `Recipe output: ${displayPath(runtime, materialization!.destination)}`,
  );
  printLine(runtime.stderr, `PDF output: ${displayPath(runtime, pdf.outputPath)}`);
  printLine(runtime.stderr, `Codex report: ${selection.report.kind}`);
  printLine(
    runtime.stderr,
    `Recipe cleanup: ${selection.lifecycle === "temporary-render" ? "after successful render" : "never"}`,
  );
  printLine(runtime.stderr, `PDF overwrite: ${pdf.overwrite ? "enabled" : "disabled"}`);
}

function printRenderWarnings(runtime: CliRuntime, warnings: readonly string[]): void {
  if (warnings.length === 0) {
    return;
  }
  printLine(runtime.stderr, "Markdown PDF render warnings:");
  for (const warning of warnings) {
    printLine(runtime.stderr, `- ${warning}`);
  }
}

function printRetainedSession(runtime: CliRuntime, session: OwnedMarkdownPdfSession): void {
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, "Temporary recipe session retained:");
  printLine(runtime.stderr, displayPath(runtime, session.path));
}

async function recoverRetainedSession(
  runtime: CliRuntime,
  session: OwnedMarkdownPdfSession,
  allowRetry: boolean,
): Promise<"retry" | GeneratedLifecycleOutcome> {
  while (true) {
    const action = await select<"retry" | "review" | "keep" | "delete">({
      message: allowRetry ? "Render recovery" : "Materialization recovery",
      choices: [
        ...(allowRetry ? [{ name: "Retry render", value: "retry" as const }] : []),
        { name: "Keep session and revise recipe", value: "review" },
        { name: "Keep session and exit", value: "keep" },
        { name: "Delete session and exit", value: "delete" },
      ],
    });
    if (action === "retry") {
      return "retry";
    }
    if (action === "review") {
      retainOwnedMarkdownPdfSession(session);
      return "review";
    }
    if (action === "keep") {
      retainOwnedMarkdownPdfSession(session);
      return "complete";
    }
    if (
      await confirm({
        message: "Delete this exact temporary recipe session?",
        default: false,
      })
    ) {
      await cleanupOwnedMarkdownPdfSession(session);
      return "complete";
    }
  }
}

async function executeRenderWithRecovery(
  runtime: CliRuntime,
  plan: PlannedMarkdownPdfRender,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
): Promise<GeneratedLifecycleOutcome> {
  while (true) {
    try {
      const result = await executePlannedMarkdownPdfRender(runtime, plan);
      printRenderWarnings(runtime, result.warnings);
      printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, plan.outputPath)}`);
      if (materialization.kind === "temporary") {
        try {
          await cleanupOwnedMarkdownPdfSession(materialization.session);
        } catch (error) {
          printLine(
            runtime.stderr,
            `Unable to remove the temporary recipe session: ${error instanceof Error ? error.message : String(error)}`,
          );
          printRetainedSession(runtime, materialization.session);
        }
      }
      return "complete";
    } catch (error) {
      printLine(
        runtime.stderr,
        `Rendering failed before a PDF was completed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (materialization.kind === "durable") {
        const next = await select<"retry" | "review" | "exit">({
          message: "Render recovery",
          choices: [
            { name: "Retry render", value: "retry" },
            { name: "Revise recipe", value: "review" },
            { name: "Exit", value: "exit" },
          ],
        });
        if (next === "retry") {
          continue;
        }
        return next === "review" ? "review" : "complete";
      }
      printRetainedSession(runtime, materialization.session);
      const next = await recoverRetainedSession(runtime, materialization.session, true);
      if (next === "retry") {
        continue;
      }
      return next;
    }
  }
}

async function materializeAndRender(
  runtime: CliRuntime,
  selection: MarkdownPdfGeneratedLifecycleSelection,
  pdf: ResolvedMarkdownPdfRenderOutput,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
): Promise<GeneratedLifecycleOutcome> {
  assertPdfOutputDoesNotCollide(runtime, pdf.outputPath, materialization, selection.report);
  await writeBoundMarkdownPdfGeneratedCandidate(materialization);
  const prepared = await prepareMarkdownPdfRender(runtime, {
    input: selection.markdownInput,
    ...materialization.rendererSource,
  });
  return await executeRenderWithRecovery(
    runtime,
    bindResolvedMarkdownPdfRenderOutput(prepared, pdf),
    materialization,
  );
}

export async function handleMarkdownPdfGeneratedLifecycle(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfGeneratedLifecycleSelection,
): Promise<GeneratedLifecycleOutcome> {
  while (true) {
    const artifactDestination =
      selection.lifecycle === "save-and-render"
        ? await promptArtifactDestination(runtime, pathPromptContext, selection)
        : undefined;
    if (artifactDestination?.kind === "review") {
      return "review";
    }
    if (artifactDestination?.kind === "cancel") {
      return "complete";
    }
    const pdf = await promptGeneratedPdfOutput(runtime, pathPromptContext, selection.markdownInput);
    if (pdf.kind === "review") {
      return "review";
    }
    if (pdf.kind === "cancel") {
      return "complete";
    }

    let durable: BoundMarkdownPdfGeneratedMaterialization | undefined;
    if (artifactDestination?.kind === "destination") {
      try {
        durable = await bindPreparedMarkdownPdfGeneratedCandidate(runtime, selection.candidate, {
          kind: "durable",
          output: artifactDestination.output,
          overwrite: artifactDestination.overwrite,
          report: selection.report,
        });
        assertPdfOutputDoesNotCollide(runtime, pdf.output.outputPath, durable, selection.report);
      } catch (error) {
        if (!(error instanceof CliError) || !RECOVERABLE_BIND_CODES.has(error.code)) {
          throw error;
        }
        printLine(runtime.stderr, `Unable to prepare recipe output: ${error.message}`);
        continue;
      }
    } else if (
      selection.report.kind === "external" &&
      resolve(runtime.cwd, selection.report.path) === resolve(pdf.output.outputPath)
    ) {
      printLine(runtime.stderr, "Unable to prepare output: PDF and report paths must differ.");
      continue;
    }

    renderGeneratedFinalReview(runtime, selection, pdf.output, durable);
    if (!(await confirm({ message: "Render this PDF?", default: true }))) {
      const next = await select<"outputs" | "review" | "cancel">({
        message: "Final render next step",
        choices: [
          { name: "Change outputs", value: "outputs" },
          { name: "Back to recipe review", value: "review" },
          { name: "Cancel", value: "cancel" },
        ],
      });
      if (next === "review") {
        return "review";
      }
      if (next === "cancel") {
        return "complete";
      }
      continue;
    }

    if (durable) {
      try {
        return await materializeAndRender(runtime, selection, pdf.output, durable);
      } catch (error) {
        printLine(
          runtime.stderr,
          `Unable to materialize the durable recipe: ${error instanceof Error ? error.message : String(error)}`,
        );
        printLine(
          runtime.stderr,
          `Durable recipe retained: ${displayPath(runtime, durable.destination)}`,
        );
        return "complete";
      }
    }

    const session = await createOwnedMarkdownPdfSession();
    try {
      if (selection.report.kind === "with-artifact") {
        throw new CliError(
          "Temporary rendering cannot retain a Codex report with the temporary recipe.",
          { code: "INVALID_INPUT", exitCode: 2 },
        );
      }
      const temporary = await bindPreparedMarkdownPdfGeneratedCandidate(
        runtime,
        selection.candidate,
        { kind: "temporary", report: selection.report, session },
      );
      return await materializeAndRender(runtime, selection, pdf.output, temporary);
    } catch (error) {
      printLine(
        runtime.stderr,
        `Unable to materialize the temporary recipe: ${error instanceof Error ? error.message : String(error)}`,
      );
      printRetainedSession(runtime, session);
      const recovered = await recoverRetainedSession(runtime, session, false);
      return recovered === "retry" ? "complete" : recovered;
    }
  }
}
