import type { Command } from "commander";

import { actionFontList, type FontListOptions } from "../actions";
import { parsePositiveIntegerOption } from "../options/parsers";
import type { CliRuntime } from "../types";

type FontListCliOptions = Omit<FontListOptions, "runner">;

export function registerFontCommands(program: Command, runtime: CliRuntime): void {
  const fontCommand = program
    .command("font")
    .alias("fonts")
    .description("Font discovery utilities");

  fontCommand
    .command("list")
    .description("List discovered system font candidates")
    .option("--json", "Output machine-readable JSON", false)
    .option("--family <name>", "Filter by family or full font name")
    .option("--limit <n>", "Limit the number of displayed font faces", (value) =>
      parsePositiveIntegerOption(value, "--limit"),
    )
    .action(async (options: FontListCliOptions) => {
      await actionFontList(runtime, options);
    });
}
