import type { HarnessRunnerContext } from "../../helpers/interactive-harness/context";

export function createMarkdownDocxActionMock(context: HarnessRunnerContext) {
  return {
    actionMdToDocx: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("md:to-docx", options);
    },
  };
}
