import { confirm } from "@inquirer/prompts";
import { resolve } from "node:path";

import {
  prepareMarkdownPdfRender,
  type ResolvedMarkdownPdfRenderOutput,
} from "../../actions/markdown/to-pdf-service";
import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import type {
  MarkdownPdfGeneratedLifecycleHandlerOutcome,
  MarkdownPdfGeneratedLifecycleSelection,
} from "./codex-types";
import { createOwnedMarkdownPdfSession } from "./lifecycle";
import {
  bindPreparedMarkdownPdfGeneratedCandidate,
  writeBoundMarkdownPdfGeneratedCandidate,
  type BoundMarkdownPdfGeneratedMaterialization,
} from "./materialization";
import {
  assertPdfOutputDoesNotAliasMaterializedOutput,
  assertPdfOutputDoesNotCollide,
  isRecoverableGeneratedLifecycleBindError,
} from "./generated-lifecycle/guards";
import {
  promptArtifactDestination,
  promptGeneratedFinalRenderNextStep,
  promptGeneratedPdfOutput,
  renderGeneratedFinalReview,
} from "./generated-lifecycle/prompts";
import {
  executeDurableMaterializationAndRender,
  executeRenderWithRecovery,
  printRetainedSession,
  recoverRetainedSession,
  type DurableMaterializationWriteState,
  type GeneratedLifecycleOutcome,
} from "./generated-lifecycle/recovery";
import {
  compileMarkdownPdfRenderCodeHighlightChoice,
  promptMarkdownPdfRenderCodeHighlightChoice,
  type MarkdownPdfRenderCodeHighlightChoice,
} from "./render-code-highlighting";

interface DurableGeneratedLifecycleResume extends DurableMaterializationWriteState {
  candidate: MarkdownPdfGeneratedLifecycleSelection["candidate"];
  materialization: Extract<BoundMarkdownPdfGeneratedMaterialization, { kind: "durable" }>;
  markdownInput: string;
  pdf: ResolvedMarkdownPdfRenderOutput;
  report: MarkdownPdfGeneratedLifecycleSelection["report"];
}

export interface MarkdownPdfGeneratedLifecycleSession {
  durableResume?: DurableGeneratedLifecycleResume;
}

export function createMarkdownPdfGeneratedLifecycleSession(): MarkdownPdfGeneratedLifecycleSession {
  return {};
}

function sameAcceptedCandidateIdentity(
  left: MarkdownPdfGeneratedLifecycleSelection["candidate"],
  right: MarkdownPdfGeneratedLifecycleSelection["candidate"],
): boolean {
  // Identity is intentional: regeneration must invalidate an otherwise equal candidate.
  return left.kind === right.kind && left.candidate === right.candidate;
}

function sameReport(
  left: MarkdownPdfGeneratedLifecycleSelection["report"],
  right: MarkdownPdfGeneratedLifecycleSelection["report"],
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== "external" || (right.kind === "external" && left.path === right.path))
  );
}

function matchingDurableResume(
  session: MarkdownPdfGeneratedLifecycleSession,
  selection: MarkdownPdfGeneratedLifecycleSelection,
): DurableGeneratedLifecycleResume | undefined {
  const resume = session.durableResume;
  if (
    resume &&
    selection.lifecycle === "save-and-render" &&
    resume.markdownInput === selection.markdownInput &&
    sameAcceptedCandidateIdentity(resume.candidate, selection.candidate) &&
    sameReport(resume.report, selection.report)
  ) {
    return resume;
  }
  session.durableResume = undefined;
  return undefined;
}

async function materializeTemporaryAndRender(
  runtime: CliRuntime,
  selection: MarkdownPdfGeneratedLifecycleSelection,
  pdfOutput: ResolvedMarkdownPdfRenderOutput,
  materialization: BoundMarkdownPdfGeneratedMaterialization,
  codeHighlight?: boolean,
): Promise<GeneratedLifecycleOutcome> {
  assertPdfOutputDoesNotCollide(runtime, pdfOutput.outputPath, materialization, selection.report);
  await writeBoundMarkdownPdfGeneratedCandidate(materialization);
  await assertPdfOutputDoesNotAliasMaterializedOutput(
    runtime,
    pdfOutput.outputPath,
    materialization,
    selection.report,
  );
  const prepared = await prepareMarkdownPdfRender(runtime, {
    input: selection.markdownInput,
    ...materialization.rendererSource,
    ...(codeHighlight === undefined ? {} : { codeHighlight }),
  });
  return await executeRenderWithRecovery(runtime, { ...pdfOutput, prepared }, materialization);
}

function toGeneratedLifecycleHandlerOutcome(
  outcome: GeneratedLifecycleOutcome,
  codeHighlight: MarkdownPdfRenderCodeHighlightChoice,
): MarkdownPdfGeneratedLifecycleHandlerOutcome {
  return outcome === "review" ? { codeHighlight, kind: "review" } : { kind: "complete" };
}

export async function handleMarkdownPdfGeneratedLifecycle(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfGeneratedLifecycleSelection,
  session: MarkdownPdfGeneratedLifecycleSession = createMarkdownPdfGeneratedLifecycleSession(),
): Promise<MarkdownPdfGeneratedLifecycleHandlerOutcome> {
  let codeHighlight = selection.codeHighlight;
  let resume = matchingDurableResume(session, selection);

  while (true) {
    const artifactDestination = resume
      ? undefined
      : selection.lifecycle === "save-and-render"
        ? await promptArtifactDestination(runtime, pathPromptContext, selection)
        : undefined;
    if (artifactDestination?.kind === "review") {
      return { codeHighlight, kind: "review" };
    }
    if (artifactDestination?.kind === "cancel") {
      session.durableResume = undefined;
      return { kind: "complete" };
    }
    const pdf = resume
      ? { kind: "output" as const, output: resume.pdf }
      : await promptGeneratedPdfOutput(runtime, pathPromptContext, selection.markdownInput);
    if (pdf.kind === "review") {
      return { codeHighlight, kind: "review" };
    }
    if (pdf.kind === "cancel") {
      session.durableResume = undefined;
      return { kind: "complete" };
    }

    let durable = resume?.materialization;
    if (!durable && artifactDestination?.kind === "destination") {
      try {
        const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
          runtime,
          selection.candidate,
          {
            kind: "durable",
            output: artifactDestination.output,
            overwrite: artifactDestination.overwrite,
            report: selection.report,
          },
        );
        if (bound.kind !== "durable") {
          throw new TypeError("Expected durable Markdown PDF materialization.");
        }
        durable = bound;
        assertPdfOutputDoesNotCollide(runtime, pdf.output.outputPath, durable, selection.report);
      } catch (error) {
        if (!isRecoverableGeneratedLifecycleBindError(error)) {
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

    while (true) {
      renderGeneratedFinalReview(runtime, selection, pdf.output, durable, codeHighlight);
      if (!(await confirm({ message: "Render this PDF?", default: true }))) {
        const next = await promptGeneratedFinalRenderNextStep();
        if (next === "review") {
          return { codeHighlight, kind: "review" };
        }
        if (next === "cancel") {
          session.durableResume = undefined;
          return { kind: "complete" };
        }
        if (next === "change-code-highlighting") {
          const changed = await promptMarkdownPdfRenderCodeHighlightChoice(codeHighlight);
          if (changed === "cancel") {
            session.durableResume = undefined;
            return { kind: "complete" };
          }
          if (changed !== "back") {
            codeHighlight = changed;
          }
          continue;
        }
        session.durableResume = undefined;
        resume = undefined;
        break;
      }

      const compiledCodeHighlight = compileMarkdownPdfRenderCodeHighlightChoice(codeHighlight);
      if (durable) {
        assertPdfOutputDoesNotCollide(runtime, pdf.output.outputPath, durable, selection.report);
        const durableState: DurableGeneratedLifecycleResume = resume ?? {
          candidate: selection.candidate,
          materialization: durable,
          markdownInput: selection.markdownInput,
          pdf: pdf.output,
          report: selection.report,
          isWritten: false,
        };
        const outcome = await executeDurableMaterializationAndRender(
          runtime,
          selection,
          pdf.output,
          durable,
          durableState,
          compiledCodeHighlight,
        );
        session.durableResume =
          outcome === "review" && durableState.isWritten ? durableState : undefined;
        return toGeneratedLifecycleHandlerOutcome(outcome, codeHighlight);
      }

      const temporarySession = await createOwnedMarkdownPdfSession();
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
          { kind: "temporary", report: selection.report, session: temporarySession },
        );
        return toGeneratedLifecycleHandlerOutcome(
          await materializeTemporaryAndRender(
            runtime,
            selection,
            pdf.output,
            temporary,
            compiledCodeHighlight,
          ),
          codeHighlight,
        );
      } catch (error) {
        printLine(
          runtime.stderr,
          `Unable to materialize the temporary recipe: ${error instanceof Error ? error.message : String(error)}`,
        );
        printRetainedSession(runtime, temporarySession);
        const recovered = await recoverRetainedSession(runtime, temporarySession, false);
        return recovered === "retry"
          ? { kind: "complete" }
          : toGeneratedLifecycleHandlerOutcome(recovered, codeHighlight);
      }
    }
  }
}
