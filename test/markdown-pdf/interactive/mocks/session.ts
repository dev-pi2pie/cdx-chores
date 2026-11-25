import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../../../cli-foundations/interactive-harness/context";
import { markdownPdfLifecycleModuleUrl } from "../module-urls";

export function installMarkdownPdfSessionMock(context: HarnessRunnerContext): void {
  let sessionCount = 0;

  mock.module(markdownPdfLifecycleModuleUrl, () => ({
    createOwnedMarkdownPdfSession: async () => {
      sessionCount += 1;
      const session = {
        path: context.resolveHarnessPath(`.harness-md-pdf-session-${sessionCount}`),
        state: "active",
      };
      context.result.markdownPdfSessionCreateCalls.push(session.path);
      return session;
    },
    assertActiveOwnedMarkdownPdfSession: (session: { state: string }) => {
      if (session.state !== "active") {
        throw new TypeError(`Markdown PDF session is ${session.state}, not active.`);
      }
    },
    retainOwnedMarkdownPdfSession: (session: { path: string; state: string }) => {
      session.state = "retained";
      context.result.markdownPdfSessionRetainCalls.push(session.path);
    },
    cleanupOwnedMarkdownPdfSession: async (session: { path: string; state: string }) => {
      context.result.markdownPdfSessionCleanupCalls.push(session.path);
      if (context.scenario.markdownPdfCleanupErrorMessage) {
        session.state = "retained";
        throw new Error(context.scenario.markdownPdfCleanupErrorMessage);
      }
      session.state = "removed";
      context.recordRemovedPath(session.path);
    },
  }));
}
