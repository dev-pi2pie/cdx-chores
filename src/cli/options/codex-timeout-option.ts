import { Option } from "commander";

import { parseUniqueCodexTimeoutDuration } from "./codex-timeout";

export function createCodexTimeoutDurationOption(optionName: string, description: string): Option {
  return new Option(`${optionName} <duration>`, description).argParser<number | undefined>(
    (value, previous) => parseUniqueCodexTimeoutDuration(value, previous, optionName),
  );
}
