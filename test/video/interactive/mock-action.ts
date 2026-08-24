import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";

export function createVideoActionMocks(context: HarnessRunnerContext) {
  return {
    actionVideoConvert: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("video:convert", options);
    },
    actionVideoResize: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("video:resize", options);
    },
    actionVideoGif: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("video:gif", options);
    },
  };
}
