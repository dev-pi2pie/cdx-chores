import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameCleanup } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: rename cleanup", () => {
  test("actionRenameCleanup validates a file target then stops at deferred implementation", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const filePath = join(fixtureDir, "Screenshot 2026-03-02 at 4.53.04 PM.png");
      await writeFile(filePath, "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(filePath),
            hints: ["timestamp"],
            dryRun: true,
          }),
        {
          code: "DEFERRED_FEATURE",
          exitCode: 2,
          messageIncludes: "rename cleanup is not implemented",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup validates a directory target then stops at deferred implementation", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, "2026-03-02 note.txt"), "note", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(dirPath),
            hints: ["date"],
            dryRun: true,
            recursive: true,
            maxDepth: 1,
          }),
        {
          code: "DEFERRED_FEATURE",
          exitCode: 2,
          messageIncludes: "rename cleanup is not implemented",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup requires at least one hint", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const filePath = join(fixtureDir, "plain.txt");
      await writeFile(filePath, "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(filePath),
            hints: [],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "At least one --hint is required.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup rejects deferred v1 hint families such as uid", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const filePath = join(fixtureDir, "uid-7k3m9q2x4t.txt");
      await writeFile(filePath, "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(filePath),
            hints: ["uid"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Invalid --hint value: uid. Expected one of: date, timestamp, serial.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup rejects directory-only flags for file targets", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const filePath = join(fixtureDir, "plain.txt");
      await writeFile(filePath, "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(filePath),
            hints: ["date"],
            recursive: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--recursive is only supported when <path> is a directory.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup requires --hint timestamp when --timestamp-action is provided", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const filePath = join(fixtureDir, "2026-03-02 note.txt");
      await writeFile(filePath, "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(filePath),
            hints: ["date"],
            timestampAction: "remove",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--timestamp-action requires --hint timestamp.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup keeps date and timestamp disjoint at the accepted hint layer", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const filePath = join(fixtureDir, "2026-03-02 at 4.53.04 PM.txt");
      await writeFile(filePath, "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(filePath),
            hints: ["date", "timestamp"],
          }),
        {
          code: "DEFERRED_FEATURE",
          exitCode: 2,
          messageIncludes: "rename cleanup is not implemented",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup validates preview-skips values", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(dirPath),
            hints: ["date"],
            previewSkips: "compact" as "summary",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Invalid --preview-skips value: compact.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionRenameCleanup requires --recursive when maxDepth is provided for directories", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const dirPath = join(fixtureDir, "cleanup-dir");
      await mkdir(dirPath, { recursive: true });

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: toRepoRelativePath(dirPath),
            hints: ["date"],
            maxDepth: 1,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--max-depth requires --recursive.",
        },
      );

      expectNoOutput();
    });
  });
});

describe("cli command: rename cleanup", () => {
  test("rename cleanup accepts --hints as an alias for --hint", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const filePath = join(fixtureDir, "plain.txt");
      await writeFile(filePath, "fake", "utf8");

      const result = runCli([
        "rename",
        "cleanup",
        toRepoRelativePath(filePath),
        "--hints",
        "date",
        "--dry-run",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("rename cleanup is not implemented");
    });
  });
});
