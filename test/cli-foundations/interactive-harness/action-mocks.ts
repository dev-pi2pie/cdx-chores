import { mock } from "bun:test";

import type { HarnessRunnerContext } from "./context";
import { actionsModuleUrl } from "./module-urls";
import { createDataConversionActionMocks } from "../../data-conversion/interactive/mock-action";
import { createDataExtractActionMock } from "../../data-extract/interactive/mock-action";
import { createDataPreviewActionMocks } from "../../data-preview/interactive/mock-action";
import { createDataQueryActionMock } from "../../data-query/interactive/mock-action";
import { createStackActionMocks } from "../../data-stack/interactive/mock-action";
import { createDoctorActionMock } from "../../doctor/interactive/mock-action";
import { createMarkdownDocxActionMock } from "../../markdown-docx/interactive/mock-action";
import { createMarkdownFrontmatterActionMock } from "../../markdown-frontmatter/interactive/mock-action";
import { createRenameActionMocks } from "../../rename/interactive/mock-action";
import { createVideoActionMocks } from "../../video/interactive/mock-action";

export function installActionMocks(context: HarnessRunnerContext): void {
  mock.module(actionsModuleUrl, () => ({
    RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS: {
      sampleLimit: 40,
      groupLimit: 12,
      examplesPerGroup: 3,
    },
    ...createMarkdownDocxActionMock(context),
    ...createDataConversionActionMocks(context),
    ...createDoctorActionMock(context),
    ...createMarkdownFrontmatterActionMock(context),
    ...createVideoActionMocks(context),
    ...createDataExtractActionMock(context),
    ...createDataPreviewActionMocks(context),
    ...createDataQueryActionMock(context),
    ...createStackActionMocks(context),
    ...createRenameActionMocks(context),
  }));
}
