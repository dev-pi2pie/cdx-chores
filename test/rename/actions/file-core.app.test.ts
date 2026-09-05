import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { actionRenameFile } from "../../../src/cli/actions";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";
import { expectCliError } from "../../helpers/cli-action-test-utils";
import { createRenameFileFixture, withRenameWorkspace } from "./file-support";

describe("rename file core actions", () => {
  test("actionRenameFile dry-run previews one file and writes a replayable CSV plan", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const { dirPath, filePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-dry-run",
        "cover image.png",
        {
          time: new Date("2026-02-25T15:16:17.000Z"),
        },
      );

      const result = await actionRenameFile(runtime, {
        path: relative(fixtureDir, filePath),
        prefix: "img",
        dryRun: true,
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(result.planCsvPath).toBeDefined();
      expect(stdout.text).toContain(`Directory: ${relative(fixtureDir, dirPath)}`);
      expect(stdout.text).toContain(`File: ${relative(fixtureDir, filePath)}`);
      expect(stdout.text).toContain("- cover image.png -> img-");
      expect(stdout.text).toContain("Plan CSV:");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("cover image.png");
      expect(csvText).toContain(",planned,");
      expect((await stat(filePath)).isFile()).toBe(true);
    });
  });

  test("actionRenameFile applies a single-file rename with collision suffix handling", async () => {
    await withRenameWorkspace(async (fixtureDir) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const { dirPath, filePath: targetPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-apply",
        "photo one.txt",
        {
          content: "a",
          time: new Date("2026-02-25T08:09:10.000Z"),
        },
      );

      const conflictingName = "doc-20260225-080910-photo-one.txt";
      await writeFile(join(dirPath, conflictingName), "occupied", "utf8");

      const result = await actionRenameFile(runtime, {
        path: relative(fixtureDir, targetPath),
        prefix: "doc",
        dryRun: false,
      });

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain(`File: ${relative(fixtureDir, targetPath)}`);
      expect(stdout.text).toContain("Renamed 1 file(s).");

      const entries = (await readdir(dirPath)).sort();
      expect(entries).toContain(conflictingName);
      expect(entries.some((name) => /^doc-20260225-080910-photo-one-01\.txt$/.test(name))).toBe(
        true,
      );
    });
  });

  test("actionRenameFile without prefix omits the old implicit file prefix", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const { filePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-no-prefix",
        "photo one.txt",
        {
          time: new Date("2026-02-25T15:16:17.000Z"),
        },
      );

      const result = await actionRenameFile(runtime, {
        path: relative(fixtureDir, filePath),
        dryRun: true,
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("- photo one.txt -> 20260225-151617-photo-one.txt");
      expect(stdout.text).not.toContain("file-20260225-151617-photo-one.txt");
    });
  });

  test("actionRenameFile rejects symlink input paths", async () => {
    if (process.platform === "win32") {
      return;
    }

    await withRenameWorkspace(async (fixtureDir) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "rename-file-symlink");
      await mkdir(dirPath, { recursive: true });

      const realPath = join(dirPath, "real.txt");
      const linkPath = join(dirPath, "link.txt");
      await writeFile(realPath, "real", "utf8");
      await symlink(realPath, linkPath);

      await expectCliError(
        () =>
          actionRenameFile(runtime, {
            path: relative(fixtureDir, linkPath),
            dryRun: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Symlink inputs are not supported for rename file:",
        },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    });
  });

  test("actionRenameFile rejects directory input paths", async () => {
    await withRenameWorkspace(async (fixtureDir) => {
      const { runtime, stdout, stderr } = createCapturedRuntime({ cwd: fixtureDir });
      const dirPath = join(fixtureDir, "rename-file-directory");
      await mkdir(dirPath, { recursive: true });

      await expectCliError(
        () =>
          actionRenameFile(runtime, {
            path: relative(fixtureDir, dirPath),
            dryRun: true,
          }),
        {
          code: "FILE_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "Input file not found:",
        },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    });
  });
});
