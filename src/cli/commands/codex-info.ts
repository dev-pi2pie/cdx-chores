import { Option, type Command } from "commander";
import type { CodexInfoView } from "../../adapters/codex/discovery/types";
import { actionCodexInfo } from "../actions/codex-info";
import type { CliRuntime } from "../types";

export function registerCodexInfoCommands(
  program: Command,
  runtime: CliRuntime,
  action: typeof actionCodexInfo = actionCodexInfo,
): void {
  const info = program
    .command("codex-info")
    .description("Inspect Codex configuration and reported model/provider information");

  function addOutput(command: Command, view: CodexInfoView) {
    command
      .option("--json", "Output machine-readable JSON")
      .addOption(
        new Option("--details", "Output detailed human-readable information").conflicts("json"),
      )
      .action(async (options: { details?: boolean; json?: boolean }) => {
        await action(runtime, {
          view,
          details: Boolean(options.details),
          json: Boolean(options.json),
        });
      });
  }
  // A default leaf keeps output flags local without changing the root parser.
  // Commander otherwise consumes child --json/--details as group options.
  const summary = info.command("summary", { isDefault: true, hidden: true });
  summary.configureHelp({ commandUsage: () => "cdx-chores codex-info [options]" });
  addOutput(summary, "summary");
  info.addHelpText(
    "after",
    "\nDefault summary options:\n  --details  Output detailed human-readable information\n  --json     Output machine-readable JSON\n\nPut output options after the invoked command, for example: codex-info models --json.",
  );
  addOutput(
    info
      .command("models")
      .description("List Codex-reported model metadata in the configured provider context"),
    "models",
  );
  addOutput(
    info
      .command("providers")
      .description("List configured provider IDs with explicit enumeration coverage"),
    "providers",
  );
}
