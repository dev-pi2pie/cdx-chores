import { expect } from "bun:test";

export { REPO_ROOT } from "./helpers/cli-test-utils";
export { runInteractiveHarness } from "./helpers/interactive-harness";

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export function dataStackDefaultOutputMatcher(
  timestamp: string,
  extension: string,
): ReturnType<typeof expect.stringMatching> {
  return expect.stringMatching(new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`));
}
