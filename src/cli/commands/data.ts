import { Command } from "commander";

import type { CliRuntime } from "../types";
import { registerDataConversionCommands } from "./data/conversions";
import { registerDataDuckDbCommands } from "./data/duckdb";
import { registerDataExtractCommand } from "./data/extract";
import { registerDataPreviewCommands } from "./data/preview";
import { registerDataQueryCommands } from "./data/query";

export function registerDataCommands(program: Command, runtime: CliRuntime): void {
  const dataCommand = program
    .command("data")
    .description("Data preview, extract, query, and conversion utilities");

  registerDataConversionCommands(dataCommand, runtime);
  registerDataPreviewCommands(dataCommand, runtime);
  registerDataDuckDbCommands(dataCommand, runtime);
  registerDataExtractCommand(dataCommand, runtime);
  registerDataQueryCommands(dataCommand, runtime);
}
