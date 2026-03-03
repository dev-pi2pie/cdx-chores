import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameCleanup } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: rename cleanup directory behavior", () => {
  test("dry-runs directory timestamp cleanup with skipped summary", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirName = "cleanup-dir";
      const dirPath = join(fixtureDir, dirName);
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(dirPath, "Screen Recording 2026-03-02 at 4.53.05 PM.mov"), "b", "utf8");
      await writeFile(join(dirPath, "plain-note.txt"), "c", "utf8");

      await actionRenameCleanup(runtime, {
        path: dirName,
        hints: ["timestamp"],
        style: "slug",
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 3");
      expect(stdout.text).toContain("Files to rename: 2");
      expect(stdout.text).toContain("Entries skipped: 1");
      expect(stdout.text).toContain("screenshot-20260302-165304.png");
      expect(stdout.text).toContain("screen-recording-20260302-165305.mov");
      expect(stdout.text).toContain("Skipped summary:");
      expect(stdout.text).toContain("- 1 no timestamp match");
    });
  });

  test("traverses subdirectories only when recursive and respects maxDepth", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      const nestedPath = join(dirPath, "nested");
      const deepPath = join(nestedPath, "deep");
      await mkdir(deepPath, { recursive: true });

      await writeFile(join(dirPath, "Root Shot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(nestedPath, "Nested Shot 2026-03-02 at 4.53.05 PM.png"), "b", "utf8");
      await writeFile(join(deepPath, "Deep Shot 2026-03-02 at 4.53.06 PM.png"), "c", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["timestamp"],
        style: "slug",
        dryRun: true,
        recursive: true,
        maxDepth: 1,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 2");
      expect(stdout.text).toContain("Files to rename: 2");
      expect(stdout.text).toContain("root-shot-20260302-165304.png");
      expect(stdout.text).toContain("nested-shot-20260302-165305.png");
      expect(stdout.text).not.toContain("deep-shot-20260302-165306.png");
    });
  });

  test("applies directory filters before planning cleanup candidates", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Meeting Notes 2026-03-02.txt"), "a", "utf8");
      await writeFile(join(dirPath, "Meeting Draft 2026-03-02.txt"), "b", "utf8");
      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "c", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["date"],
        style: "slug",
        dryRun: true,
        matchRegex: "^Meeting",
        skipRegex: "Draft",
        ext: ["txt"],
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("Files to rename: 1");
      expect(stdout.text).toContain("meeting-notes-20260302.txt");
      expect(stdout.text).not.toContain("meeting-draft-20260302.txt");
      expect(stdout.text).not.toContain("screenshot-20260302-165304.png");
    });
  });

  test("skips conflicting directory cleanup targets within the same run", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.05 PM.png"), "b", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["timestamp"],
        style: "slug",
        timestampAction: "remove",
        conflictStrategy: "skip",
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 2");
      expect(stdout.text).toContain("Files to rename: 1");
      expect(stdout.text).toContain("Entries skipped: 1");
      expect(stdout.text).toContain("screenshot.png");
      expect(stdout.text).toContain("Skipped summary:");
      expect(stdout.text).toContain("- 1 target conflict");
    });
  });

  test("resolves same-run directory conflicts with number strategy", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.05 PM.png"), "b", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["timestamp"],
        style: "slug",
        timestampAction: "remove",
        conflictStrategy: "number",
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 2");
      expect(stdout.text).toContain("Files to rename: 2");
      expect(stdout.text).not.toContain("target conflict");
      expect(stdout.text).toContain("screenshot.png");
      expect(stdout.text).toContain("screenshot-1.png");
    });
  });

  test("resolves same-run directory conflicts with uid-suffix strategy", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.05 PM.png"), "b", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["timestamp"],
        style: "slug",
        timestampAction: "remove",
        conflictStrategy: "uid-suffix",
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 2");
      expect(stdout.text).toContain("Files to rename: 2");
      expect(stdout.text).not.toContain("target conflict");
      expect(stdout.text).toContain("screenshot.png");
      expect(stdout.text).toMatch(/screenshot-uid-[0-9a-hjkmnpqrstvwxyz]{10}\.png/);
    });
  });

  test("skips directory cleanup targets that conflict with existing files", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Screenshot 2026-03-02 at 4.53.04 PM.png"), "a", "utf8");
      await writeFile(join(dirPath, "screenshot.png"), "existing", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["timestamp"],
        style: "slug",
        timestampAction: "remove",
        dryRun: true,
        previewSkips: "detailed",
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 2");
      expect(stdout.text).toContain("Files to rename: 0");
      expect(stdout.text).toContain("Entries skipped: 2");
      expect(stdout.text).toContain("Skipped summary:");
      expect(stdout.text).toContain("- 1 no timestamp match");
      expect(stdout.text).toContain("- 1 target conflict");
      expect(stdout.text).toContain("Skipped details:");
      expect(stdout.text).toContain("Screenshot 2026-03-02 at 4.53.04 PM.png");
      expect(stdout.text).toContain("screenshot.png");
    });
  });

  test("ignores generated rename plan csv artifacts in directory scans", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "Meeting Notes 2026-03-02.txt"), "a", "utf8");
      await writeFile(join(dirPath, "rename-plan-20260303T070111Z-07e91641.csv"), "plan", "utf8");

      await actionRenameCleanup(runtime, {
        path: "cleanup-dir",
        hints: ["date"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Files found: 1");
      expect(stdout.text).toContain("Files to rename: 1");
      expect(stdout.text).not.toContain("rename-plan-20260303T070111Z-07e91641.csv");
    });
  });
});
