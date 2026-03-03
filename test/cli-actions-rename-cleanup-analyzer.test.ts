import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { collectRenameCleanupAnalyzerEvidence } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: rename cleanup analyzer evidence", () => {
  test("collects file-target evidence from a single basename", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "Screenshot 2026-03-02 at 4.53.04 PM.png";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      const evidence = await collectRenameCleanupAnalyzerEvidence(runtime, {
        path: fileName,
      });

      expectNoOutput();
      expect(evidence).toEqual({
        targetKind: "file",
        targetPath: join(fixtureDir, fileName),
        totalCandidateCount: 1,
        sampledCount: 1,
        sampleNames: [fileName],
        groupedPatterns: [
          {
            pattern: "screenshot-{timestamp}.png",
            count: 1,
            examples: [fileName],
          },
        ],
      });
    });
  });

  test("collects bounded directory evidence after applying filters", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      const nestedPath = join(dirPath, "nested");
      await mkdir(nestedPath, { recursive: true });

      await writeFile(join(dirPath, "app-00001.log"), "a", "utf8");
      await writeFile(join(dirPath, "app-00002.log"), "b", "utf8");
      await writeFile(join(dirPath, "report uid-abcd2345jk final.txt"), "c", "utf8");
      await writeFile(join(dirPath, "ignore-me.txt"), "d", "utf8");
      await writeFile(join(nestedPath, "app-00003.log"), "e", "utf8");
      await writeFile(join(nestedPath, "rename-plan-20260303T070111Z-07e91641.csv"), "plan", "utf8");

      const evidence = await collectRenameCleanupAnalyzerEvidence(runtime, {
        path: "cleanup-dir",
        recursive: true,
        ext: ["log", "txt"],
        skipRegex: "ignore",
        sampleLimit: 3,
        groupLimit: 2,
        examplesPerGroup: 2,
      });

      expectNoOutput();
      expect(evidence.targetKind).toBe("directory");
      expect(evidence.targetPath).toBe(dirPath);
      expect(evidence.totalCandidateCount).toBe(4);
      expect(evidence.sampledCount).toBe(3);
      expect(evidence.sampleNames).toEqual([
        "app-00001.log",
        "app-00002.log",
        "nested/app-00003.log",
      ]);
      expect(evidence.groupedPatterns).toEqual([
        {
          pattern: "app-{serial}.log",
          count: 3,
          examples: ["app-00001.log", "app-00002.log"],
        },
      ]);
    });
  });

  test("captures mixed grouped patterns with representative relative examples", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.05 PM.png"), "b", "utf8");
      await writeFile(join(dirPath, "Meeting Notes 2026-03-02.txt"), "c", "utf8");
      await writeFile(join(dirPath, "Meeting Notes 2026-03-03.txt"), "d", "utf8");

      const evidence = await collectRenameCleanupAnalyzerEvidence(runtime, {
        path: "cleanup-dir",
        sampleLimit: 10,
        groupLimit: 10,
        examplesPerGroup: 3,
      });

      expectNoOutput();
      expect(evidence.totalCandidateCount).toBe(4);
      expect(evidence.groupedPatterns).toEqual([
        {
          pattern: "meeting-notes-{date}.txt",
          count: 2,
          examples: ["Meeting Notes 2026-03-02.txt", "Meeting Notes 2026-03-03.txt"],
        },
        {
          pattern: "screenshot-{timestamp}.png",
          count: 2,
          examples: [
            "Screenshot 2026-03-02 at 4.53.04 PM.png",
            "Screenshot 2026-03-02 at 4.53.05 PM.png",
          ],
        },
      ]);
    });
  });
});
