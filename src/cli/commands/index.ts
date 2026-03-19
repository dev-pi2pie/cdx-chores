import type { Command } from "commander";

import { actionDoctor } from "../actions";
import { runInteractiveMode } from "../interactive";
import type { CliRuntime } from "../types";
import { registerDataCommands } from "./data";
import { registerMarkdownCommands } from "./markdown";
import { registerRenameCommands } from "./rename";
import { registerVideoCommands } from "./video";

export function registerCliCommands(program: Command, runtime: CliRuntime): void {
  program
    .command("interactive")
    .description("Start interactive mode")
    .action(async () => {
      await runInteractiveMode(runtime);
    });

  program
    .command("doctor")
    .description("Check tool availability and current feature capabilities")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: { json?: boolean }) => {
      await actionDoctor(runtime, { json: options.json });
    });

  registerDataCommands(program, runtime);
  registerMarkdownCommands(program, runtime);
  registerRenameCommands(program, runtime);
  registerVideoCommands(program, runtime);
}
