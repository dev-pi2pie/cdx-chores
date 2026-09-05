import { Option, type Command } from "commander";

import { actionDoctor } from "../actions";
import { runInteractiveMode } from "../interactive";
import { createCodexTimeoutDurationOption } from "../options/codex-timeout-option";
import {
  applyCodexExecutionOptions,
  resolveCodexExecutionCommandOptions,
  type CodexExecutionCommandOptions,
} from "../options/codex-execution-option";
import type { CliRuntime } from "../types";
import { registerDataCommands } from "./data";
import { registerCodexInfoCommands } from "./codex-info";
import type { actionCodexInfo } from "../actions/codex-info";
import { registerFontCommands } from "./font";
import { registerMarkdownCommands } from "./markdown";
import { registerRenameCommands } from "./rename";
import { registerVideoCommands } from "./video";

interface RegisterCliCommandsImpls {
  actionCodexInfoImpl?: typeof actionCodexInfo;
  actionDoctorImpl?: typeof actionDoctor;
  runInteractiveModeImpl?: typeof runInteractiveMode;
}

export function registerCliCommands(
  program: Command,
  runtime: CliRuntime,
  impls: RegisterCliCommandsImpls = {},
): void {
  const actionDoctorImpl = impls.actionDoctorImpl ?? actionDoctor;
  const runInteractiveModeImpl = impls.runInteractiveModeImpl ?? runInteractiveMode;
  applyCodexExecutionOptions(program.command("interactive").description("Start interactive mode"))
    .addOption(
      createCodexTimeoutDurationOption(
        "--codex-timeout",
        "Timeout for each Codex request attempt in this Interactive session",
      ),
    )
    .action(async (options: CodexExecutionCommandOptions & { codexTimeout?: number }) => {
      await runInteractiveModeImpl(runtime, undefined, {
        codexTimeoutMs: options.codexTimeout,
        codexExecution: resolveCodexExecutionCommandOptions(options),
      });
    });

  program
    .command("doctor")
    .description("Check tool availability and current feature capabilities")
    .option("--json", "Output machine-readable JSON", false)
    .addOption(new Option("--details", "Output detailed human-readable evidence").conflicts("json"))
    .action(async (options: { details?: boolean; json?: boolean }) => {
      await actionDoctorImpl(runtime, { details: Boolean(options.details), json: options.json });
    });

  registerDataCommands(program, runtime);
  registerCodexInfoCommands(program, runtime, impls.actionCodexInfoImpl);
  registerFontCommands(program, runtime);
  registerMarkdownCommands(program, runtime);
  registerRenameCommands(program, runtime);
  registerVideoCommands(program, runtime);
}
