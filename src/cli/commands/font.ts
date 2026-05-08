import type { Command } from "commander";
import { InvalidArgumentError } from "commander";

import {
  actionFontInspect,
  actionFontList,
  type FontInspectOptions,
  type FontListOptions,
} from "../actions";
import { parsePositiveIntegerOption } from "../options/parsers";
import type { CliRuntime } from "../types";
import { FONT_DISCOVERY_MODES, type FontDiscoveryMode } from "../../fonts";

type FontListCliOptions = Omit<FontListOptions, "runner">;
type FontInspectCliOptions = Omit<FontInspectOptions, "runner">;

function parseFontDiscoveryOption(value: string): FontDiscoveryMode {
  if ((FONT_DISCOVERY_MODES as readonly string[]).includes(value)) {
    return value as FontDiscoveryMode;
  }
  throw new InvalidArgumentError(`--discovery must be one of: ${FONT_DISCOVERY_MODES.join(", ")}.`);
}

function addCommonFontDiscoveryOptions(command: Command): Command {
  return command
    .option("--json", "Output machine-readable JSON", false)
    .option("--debug", "Show font discovery attempts and selected adapter", false)
    .option(
      "--discovery <mode>",
      "Select discovery mode: auto, native, fontconfig",
      parseFontDiscoveryOption,
    );
}

export function registerFontCommands(program: Command, runtime: CliRuntime): void {
  const fontCommand = program
    .command("font")
    .alias("fonts")
    .description("Font discovery utilities");

  addCommonFontDiscoveryOptions(
    fontCommand.command("list").description("List discovered system font candidates"),
  )
    .option("--family <name>", "Filter by family or full font name")
    .option("--limit <n>", "Limit the number of displayed font faces", (value) =>
      parsePositiveIntegerOption(value, "--limit"),
    )
    .action(async (options: FontListCliOptions) => {
      await actionFontList(runtime, options);
    });

  addCommonFontDiscoveryOptions(
    fontCommand.command("inspect").description("Inspect discovered metadata for a font family"),
  )
    .option("--family <name>", "Font family to inspect")
    .action(async (options: FontInspectCliOptions) => {
      await actionFontInspect(runtime, options);
    });
}
