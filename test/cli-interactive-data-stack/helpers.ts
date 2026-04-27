import { expect } from "bun:test";

export { runInteractiveHarness } from "../helpers/interactive-harness";
export { stripAnsi } from "../cli-actions-data-preview/helpers";

export const DEFAULT_DATA_STACK_TIMESTAMP = "20260225T000000Z";

export function dataStackDefaultOutputMatcher(
  timestamp: string,
  extension: string,
): ReturnType<typeof expect.stringMatching> {
  return expect.stringMatching(new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`));
}

export function dataStackDefaultPathPattern(timestamp: string, extension: string): RegExp {
  return new RegExp(`data-stack-${timestamp}-[a-f0-9]{8}\\.${extension}$`);
}
