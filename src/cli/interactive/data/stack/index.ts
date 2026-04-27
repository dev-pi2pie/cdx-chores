import { writePreparedDataStackOutput } from "../../../actions";
import { displayPath, printLine } from "../../../actions/shared";
import { enforceDataStackDuplicatePolicy } from "../../../data-stack/diagnostics";
import { writeInteractiveFlowTip } from "../../contextual-tip";
import type { InteractivePathPromptContext } from "../../shared";
import type { CliRuntime } from "../../../types";
import { maybeKeepInteractiveStackPlan } from "./artifacts";
import { collectInteractiveStackSetup } from "./source-discovery";
import { confirmInteractiveStackWrite, renderSkippedInteractiveStackWrite } from "./write-flow";

export async function runInteractiveDataStack(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  writeInteractiveFlowTip(runtime, "data-stack");

  while (true) {
    const setup = await collectInteractiveStackSetup(runtime, pathPromptContext);
    if (!setup) {
      renderSkippedInteractiveStackWrite(runtime);
      return;
    }
    const outcome = await confirmInteractiveStackWrite(runtime, pathPromptContext, setup);
    if (outcome.kind === "cancel") {
      return;
    }
    if (outcome.kind === "dry-run") {
      return;
    }
    if (outcome.kind === "review") {
      continue;
    }

    try {
      enforceDataStackDuplicatePolicy({
        diagnostics: outcome.diagnostics,
        policy: outcome.planArtifact.duplicates.policy,
        uniqueBy: outcome.planArtifact.duplicates.uniqueBy,
      });
      await writePreparedDataStackOutput(runtime, {
        diagnostics: outcome.diagnostics,
        outputFormat: outcome.plan.outputFormat,
        outputPath: outcome.outputPath,
        overwrite: outcome.plan.overwrite,
        prepared: outcome.prepared,
        uniqueBy: outcome.planArtifact.duplicates.uniqueBy,
      });
    } catch (error) {
      printLine(
        runtime.stderr,
        `Keeping stack plan after failed write: ${displayPath(runtime, outcome.planPath)}`,
      );
      throw error;
    }
    await maybeKeepInteractiveStackPlan(runtime, outcome.planPath);
    return;
  }
}
