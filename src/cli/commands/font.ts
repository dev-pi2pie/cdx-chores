import type { Command } from "commander";
import { InvalidArgumentError } from "commander";

import {
  actionFontCheck,
  actionFontInspect,
  actionFontList,
  type FontCheckOptions,
  type FontInspectOptions,
  type FontListOptions,
} from "../actions";
import { CliError } from "../errors";
import { parsePositiveIntegerOption } from "../options/parsers";
import type { CliRuntime } from "../types";
import { FONT_DISCOVERY_MODES, type FontDiscoveryMode } from "../../fonts";

type FontListCliOptions = Omit<FontListOptions, "runner">;
type FontInspectCliOptions = Omit<FontInspectOptions, "runner">;
type FontCheckCliOptions = Omit<FontCheckOptions, "runner" | "discovery"> & {
  discovery?: string;
};

function parseFontDiscoveryOption(value: string): FontDiscoveryMode {
  if ((FONT_DISCOVERY_MODES as readonly string[]).includes(value)) {
    return value as FontDiscoveryMode;
  }
  throw new InvalidArgumentError(`--discovery must be one of: ${FONT_DISCOVERY_MODES.join(", ")}.`);
}

function parseFontDiscoveryUsageOption(value: string | undefined): FontDiscoveryMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if ((FONT_DISCOVERY_MODES as readonly string[]).includes(value)) {
    return value as FontDiscoveryMode;
  }
  throw new CliError(`--discovery must be one of: ${FONT_DISCOVERY_MODES.join(", ")}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function addCommonFontOutputOptions(command: Command): Command {
  return command
    .option("--json", "Output machine-readable JSON", false)
    .option("--debug", "Show font discovery attempts and selected adapter", false);
}

function addParsedFontDiscoveryOption(command: Command): Command {
  return command.option(
    "--discovery <mode>",
    "Select discovery mode: auto, native, fontconfig",
    parseFontDiscoveryOption,
  );
}

function addRawFontDiscoveryOption(command: Command): Command {
  return command.option("--discovery <mode>", "Select discovery mode: auto, native, fontconfig");
}

function addCommonFontDiscoveryOptions(command: Command): Command {
  return addParsedFontDiscoveryOption(addCommonFontOutputOptions(command));
}

function addFontCheckDiscoveryOptions(command: Command): Command {
  return addRawFontDiscoveryOption(addCommonFontOutputOptions(command));
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

  addFontCheckDiscoveryOptions(
    fontCommand.command("check").description("Check selected font coverage for sample text"),
  )
    .option("--family <name>", "Font family to check")
    .option("--text <value>", "Inline sample text to check")
    .option("--text-file <path>", "Raw UTF-8 text file to check")
    .option("--require <kind>", "Additional requirement: nerd")
    .action(async (options: FontCheckCliOptions) => {
      const result = await actionFontCheck(runtime, {
        ...options,
        discovery: parseFontDiscoveryUsageOption(options.discovery),
      });
      process.exitCode = result.exitCode;
    });
}
