import { describe, expect, test } from "bun:test";
import { relative } from "node:path";
import { readFile } from "node:fs/promises";

import { actionRenameFile } from "../../../src/cli/actions";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";
import { createRenameFileFixture, withRenameWorkspace } from "./file-support";

describe("rename file Codex image actions", () => {
  test("actionRenameFile codex mode shows progress and fallback messaging when Codex returns an error", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const { filePath: imagePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-fallback",
        "single.png",
        {
          content: "fakepng",
        },
      );

      const result = await actionRenameFile(runtime, {
        path: relative(fixtureDir, imagePath),
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
