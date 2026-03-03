import { describe, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameCleanup } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: rename cleanup validation", () => {
  test("requires at least one hint", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await writeFile(join(fixtureDir, "plain.txt"), "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: "plain.txt",
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

  test("rejects directory-only flags for file targets", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await writeFile(join(fixtureDir, "plain.txt"), "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: "plain.txt",
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

  test("requires --hint timestamp when --timestamp-action is provided", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await writeFile(join(fixtureDir, "2026-03-02 note.txt"), "fake", "utf8");

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: "2026-03-02 note.txt",
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

  test("validates preview-skips values", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await mkdir(join(fixtureDir, "cleanup-dir"), { recursive: true });

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: "cleanup-dir",
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

  test("requires --recursive when maxDepth is provided for directories", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await mkdir(join(fixtureDir, "cleanup-dir"), { recursive: true });

      await expectCliError(
        () =>
          actionRenameCleanup(runtime, {
            path: "cleanup-dir",
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
