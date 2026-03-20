import type { Command } from "commander";

import { actionDataDuckDbDoctor, actionDataDuckDbExtensionInstall } from "../../actions";
import { DUCKDB_MANAGED_EXTENSION_NAMES, type DuckDbManagedExtensionName } from "../../duckdb/extensions";
import { parseDuckDbManagedExtensionOption } from "../../options/parsers";
import type { CliRuntime } from "../../types";

export function registerDataDuckDbCommands(dataCommand: Command, runtime: CliRuntime): void {
  const duckdbCommand = dataCommand.command("duckdb").description("DuckDB extension inspection and setup utilities");

  duckdbCommand
    .command("doctor")
    .description("Inspect DuckDB-managed extension state for data query and data extract")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options: { json?: boolean }) => {
      await actionDataDuckDbDoctor(runtime, { json: options.json });
    });

  const duckdbExtensionCommand = duckdbCommand
    .command("extension")
    .description("Manage DuckDB extensions used by data query and data extract");

  duckdbExtensionCommand
    .command("install")
    .description("Install a managed DuckDB extension for the current runtime")
    .argument("[name]", `Extension name (${DUCKDB_MANAGED_EXTENSION_NAMES.join(", ")})`, parseDuckDbManagedExtensionOption)
    .option("--all-supported", "Install all managed DuckDB extensions", false)
    .action(
      async (
        extensionName: DuckDbManagedExtensionName | undefined,
        options: { allSupported?: boolean },
      ) => {
        await actionDataDuckDbExtensionInstall(runtime, {
          allSupported: options.allSupported,
          extensionName,
        });
      },
    );
}
