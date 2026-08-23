import type { HarnessRunnerContext } from "../context";

export function createMiscActionMocks(context: HarnessRunnerContext) {
  return {
    actionMdToDocx: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("md:to-docx", options);
    },
  };
}
