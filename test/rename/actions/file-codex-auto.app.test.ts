import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { actionRenameFile } from "../../../src/cli/actions";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";
import { createRenameFileFixture, withRenameWorkspace } from "./file-support";

describe("rename file Codex automatic routing", () => {
  test("actionRenameFile codex auto routes markdown through the document analyzer", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const { filePath: docPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-auto-doc",
        "weekly notes.md",
        {
          content: "# Weekly Sync\n\nAgenda and action items.\n",
        },
      );

      let imageCalls = 0;
      let docCalls = 0;
      const docTimeouts: Array<number | undefined> = [];
      const result = await actionRenameFile(runtime, {
        path: relative(fixtureDir, docPath),
        prefix: "doc",
        dryRun: true,
        codex: true,
        codexImagesTitleSuggester: async () => {
          imageCalls += 1;
          return { suggestions: [] };
        },
        codexDocsTitleSuggester: async (options) => {
          docCalls += 1;
          docTimeouts.push(options.timeoutMs);
          return {
            suggestions: options.documentPaths.map((path) => ({
              path,
              title: "weekly sync notes",
            })),
          };
        },
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(imageCalls).toBe(0);
      expect(docCalls).toBe(1);
      expect(docTimeouts).toEqual([30_000]);
      expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
      expect(stdout.text).toContain("Codex doc titles: 1/1 document file(s) suggested");
      expect(stdout.text).toContain("- weekly notes.md -> doc-");
      expect(stdout.text).toContain("weekly-sync-notes");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("weekly sync notes");
    });
  });

  test("actionRenameFile codex auto reports unsupported files without analyzer calls", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const { filePath: videoPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-auto-unsupported",
        "clip.mp4",
        {
          content: "fake-video",
        },
      );

      let imageCalls = 0;
      let docCalls = 0;
      const result = await actionRenameFile(runtime, {
        path: relative(fixtureDir, videoPath),
        prefix: "media",
        dryRun: true,
        codex: true,
        codexImagesTitleSuggester: async () => {
          imageCalls += 1;
          return { suggestions: [] };
        },
        codexDocsTitleSuggester: async () => {
          docCalls += 1;
          return { suggestions: [] };
        },
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(imageCalls).toBe(0);
      expect(docCalls).toBe(0);
      expect(stdout.text).toContain(
        "Codex note: this file is not a supported Codex analyzer input; deterministic rename is used.",
      );
      expect(stdout.text).toContain("- clip.mp4 -> media-");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    });
  });
});
