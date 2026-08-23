import { expect } from "bun:test";

export { REPO_ROOT } from "./helpers/cli-test-utils";
export { runInteractiveHarness } from "./helpers/interactive-harness";
export { stripAnsi } from "./helpers/ansi";

export function dataStackDefaultOutputMatcher(
  timestamp: string,
  extension: string,
): ReturnType<typeof expect.stringMatching> {
  return expect.stringMatching(new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`));
}
