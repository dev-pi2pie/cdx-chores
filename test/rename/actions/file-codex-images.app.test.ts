import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { actionRenameFile } from "../../../src/cli/actions";
import { createCapturedRuntime, toRepoRelativePath } from "../../helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
} from "../support/plan-artifacts";
import { createRenameFileFixture, withRenameWorkspace } from "./file-support";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("rename file Codex image actions", () => {
  test("actionRenameFile codex mode shows progress and fallback messaging when Codex returns an error", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { filePath: imagePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-fallback",
        "single.png",
        {
          content: "fakepng",
        },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(imagePath),
        prefix: "img",
        dryRun: true,
        codexImages: true,
        codexImagesTitleSuggester: async () => ({
          suggestions: [],
          errorMessage: "Codex unavailable in test",
        }),
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("Codex: analyzing 1 image file(s)...");
      expect(stdout.text).toContain(
        "Codex image titles: 0/1 image file(s) suggested (fallback used for others)",
      );
      expect(stdout.text).toContain("Codex note: Codex unavailable in test");
      expect(stdout.text).toContain("- single.png -> img-");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("codex_fallback_error");
    });
  });
});
