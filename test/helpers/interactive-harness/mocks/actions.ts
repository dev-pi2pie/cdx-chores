import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";
import { actionsModuleUrl } from "../module-urls";
import { createDataExtractActionMock } from "../../../data-extract/interactive/mock-action";
import { createDataQueryActionMock } from "../../../data-query/interactive/mock-action";
import { createDoctorActionMock } from "../../../doctor/interactive/mock-action";
import { createMarkdownFrontmatterActionMock } from "../../../markdown-frontmatter/interactive/mock-action";
import { createVideoActionMocks } from "../../../video/interactive/mock-action";
import { createMiscActionMocks } from "./action-misc";
import { createRenameActionMocks } from "./action-rename";
import { createStackActionMocks } from "./action-stack";

export function installActionMocks(context: HarnessRunnerContext): void {
  mock.module(actionsModuleUrl, () => ({
    RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS: {
      sampleLimit: 40,
      groupLimit: 12,
      examplesPerGroup: 3,
    },
    ...createMiscActionMocks(context),
    ...createDoctorActionMock(context),
    ...createMarkdownFrontmatterActionMock(context),
    ...createVideoActionMocks(context),
    ...createDataExtractActionMock(context),
    ...createDataQueryActionMock(context),
    ...createStackActionMocks(context),
    ...createRenameActionMocks(context),
  }));
}
