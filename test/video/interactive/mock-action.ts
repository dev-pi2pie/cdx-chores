import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";
import { mock } from "bun:test";

export function installVideoFramesWorkflowMock(context: HarnessRunnerContext): void {
  mock.module(
    new URL("../../../src/cli/interactive/video-frames/workflow.ts", import.meta.url).href,
    () => ({
      handleVideoFramesInteractive: async () => context.recordAction("video:frames", {}),
    }),
  );
}

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
