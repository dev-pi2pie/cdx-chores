import type { HarnessRunnerContext } from "../../helpers/interactive-harness/context";

export function createMarkdownFrontmatterActionMock(context: HarnessRunnerContext) {
  return {
    actionMdFrontmatterToJson: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("md:frontmatter-to-json", options);
    },
  };
}
