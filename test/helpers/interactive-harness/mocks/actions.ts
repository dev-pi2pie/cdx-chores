import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";
import { actionsModuleUrl } from "../module-urls";
import { createDataActionMocks } from "./action-data";
import { createMiscActionMocks } from "./action-misc";
import { createRenameActionMocks } from "./action-rename";

export function installActionMocks(context: HarnessRunnerContext): void {
  mock.module(actionsModuleUrl, () => ({
    RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS: {
      sampleLimit: 40,
      groupLimit: 12,
      examplesPerGroup: 3,
    },
    ...createMiscActionMocks(context),
    ...createDataActionMocks(context),
    ...createRenameActionMocks(context),
  }));
}
