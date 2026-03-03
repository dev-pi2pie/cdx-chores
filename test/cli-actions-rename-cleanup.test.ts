import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameCleanup } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: rename cleanup", () => {
  test("actionRenameCleanup dry-runs a single timestamp cleanup with preserve style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "Screenshot 2026-03-02 at 4.53.04 PM.png";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["timestamp"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Screenshot 2026-03-02 at 4.53.04 PM.png -> Screenshot 20260302-165304.png");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");

      const entries = await readdir(fixtureDir);
      const planCsv = entries.find((entry) => /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/.test(entry));
      expect(planCsv).toBeDefined();

      const csvText = await readFile(join(fixtureDir, planCsv!), "utf8");
      expect(csvText).toContain("Screenshot 20260302-165304.png");
    });
  });

  test("actionRenameCleanup applies a single timestamp cleanup with slug style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "Screen Recording 2026-03-02 at 4.53.04 PM.mov";
      const sourcePath = join(fixtureDir, sourceName);
      const targetPath = join(fixtureDir, "screen-recording-20260302-165304.mov");
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["timestamp"],
        style: "slug",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> screen-recording-20260302-165304.mov`);
      await expect(stat(targetPath)).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("actionRenameCleanup removes a matched timestamp when requested", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "Screenshot 2026-03-02 at 4.53.04 PM.png";
      const sourcePath = join(fixtureDir, sourceName);
      const targetPath = join(fixtureDir, "screenshot.png");
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["timestamp"],
        style: "slug",
        timestampAction: "remove",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> screenshot.png`);
      await expect(stat(targetPath)).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("actionRenameCleanup skips a single file with no timestamp match", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "plain-note.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["timestamp"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("- plain-note.txt (unchanged)");
      expect(stdout.text).toContain("Reason: no timestamp match");

      const entries = await readdir(fixtureDir);
      const planCsv = entries.find((entry) => /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/.test(entry));
      expect(planCsv).toBeDefined();
      const csvText = await readFile(join(fixtureDir, planCsv!), "utf8");
      expect(csvText).toContain(",skipped,no timestamp match,");
    });
  });

  test("actionRenameCleanup dry-runs directory timestamp cleanup with skipped summary", async () => {
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

  test("actionRenameCleanup traverses subdirectories only when recursive and respects maxDepth", async () => {
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

  test("actionRenameCleanup applies directory filters before planning cleanup candidates", async () => {
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

  test("actionRenameCleanup dry-runs a single date cleanup with preserve style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "Meeting Notes 2026-03-02.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["date"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Meeting Notes 2026-03-02.txt -> Meeting Notes 20260302.txt");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    });
  });

  test("actionRenameCleanup applies a single date cleanup with slug style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "Meeting Notes 2026-03-02.txt";
      const sourcePath = join(fixtureDir, sourceName);
      const targetPath = join(fixtureDir, "meeting-notes-20260302.txt");
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["date"],
        style: "slug",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> meeting-notes-20260302.txt`);
      await expect(stat(targetPath)).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("actionRenameCleanup keeps date and timestamp disjoint for date-only hinting", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "Screenshot 2026-03-02 at 4.53.04 PM.png";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["date"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("- Screenshot 2026-03-02 at 4.53.04 PM.png (unchanged)");
      expect(stdout.text).toContain("Reason: no date match");
    });
  });

  test("actionRenameCleanup still cleans standalone date fragments when a timestamp also exists elsewhere", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "release 2026-03-01 Screenshot 2026-03-02 at 4.53.04 PM.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["date"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain(
        `${fileName} -> release 20260301 Screenshot 2026-03-02 at 4.53.04 PM.txt`,
      );
    });
  });

  test("actionRenameCleanup dry-runs a single serial cleanup with preserve style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "scan (12).pdf";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["serial"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("scan (12).pdf -> scan 12.pdf");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    });
  });

  test("actionRenameCleanup applies a single serial cleanup with slug style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "scan_003.pdf";
      const sourcePath = join(fixtureDir, sourceName);
      const targetPath = join(fixtureDir, "scan-003.pdf");
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["serial"],
        style: "slug",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> scan-003.pdf`);
      await expect(stat(targetPath)).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("actionRenameCleanup does not treat camera-style stems as serial in v1", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "IMG_1234.JPG";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["serial"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("- IMG_1234.JPG (unchanged)");
      expect(stdout.text).toContain("Reason: no serial match");
    });
  });

  test("actionRenameCleanup does not treat trailing date fragments as serial counters", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "Meeting Notes 2026-03-02.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["serial"],
        style: "slug",
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain(`- ${fileName} (unchanged)`);
      expect(stdout.text).toContain("Reason: no serial match");
    });
  });

  test("actionRenameCleanup requires at least one hint", async () => {
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

  test("actionRenameCleanup dry-runs a single uid cleanup with preserve style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "report uid-7k3m9q2x4t final.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["uid"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${fileName} -> report final.txt`);
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    });
  });

  test("actionRenameCleanup rejects directory-only flags for file targets", async () => {
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

  test("actionRenameCleanup requires --hint timestamp when --timestamp-action is provided", async () => {
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

  test("actionRenameCleanup applies timestamp-first behavior when both date and timestamp hints are provided", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "Screenshot 2026-03-02 at 4.53.04 PM.png";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["date", "timestamp"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Screenshot 2026-03-02 at 4.53.04 PM.png -> Screenshot 20260302-165304.png");
    });
  });

  test("actionRenameCleanup applies multiple selected hints sequentially on one filename", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "report 2026-03-02 uid-7k3m9q2x4t final.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["date", "uid"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${fileName} -> report 20260302 final.txt`);
    });
  });

  test("actionRenameCleanup validates preview-skips values", async () => {
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

  test("actionRenameCleanup requires --recursive when maxDepth is provided for directories", async () => {
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

  test("actionRenameCleanup applies deterministic uid style for matched cleanup input", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "Meeting Notes 2026-03-02.txt";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["date"],
        style: "uid",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> uid-`);

      const entries = await readdir(fixtureDir);
      const uidEntry = entries.find((entry) => /^uid-[0-9a-hjkmnpqrstvwxyz]{10}\.txt$/.test(entry));
      expect(uidEntry).toBeDefined();
      expect(uidEntry).not.toBe(sourceName);
      await expect(stat(join(fixtureDir, uidEntry!))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("actionRenameCleanup applies deterministic uid style when matching an existing uid fragment", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "report uid-7k3m9q2x4t final.txt";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["uid"],
        style: "uid",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> uid-`);

      const entries = await readdir(fixtureDir);
      const uidEntries = entries.filter((entry) => /^uid-[0-9a-hjkmnpqrstvwxyz]{10}\.txt$/.test(entry));
      expect(uidEntries).toHaveLength(1);
      expect(uidEntries[0]).not.toBe(sourceName);
      await expect(stat(join(fixtureDir, uidEntries[0]!))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("actionRenameCleanup skips a single file with no uid match", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const fileName = "plain-note.txt";
      await writeFile(join(fixtureDir, fileName), "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: fileName,
        hints: ["uid"],
        dryRun: true,
      });

      expectNoStderr();
      expect(stdout.text).toContain("- plain-note.txt (unchanged)");
      expect(stdout.text).toContain("Reason: no uid match");
    });
  });

  test("actionRenameCleanup skips conflicting directory cleanup targets within the same run", async () => {
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

  test("actionRenameCleanup skips directory cleanup targets that conflict with existing files", async () => {
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

  test("actionRenameCleanup ignores generated rename plan csv artifacts in directory scans", async () => {
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

describe("cli command: rename cleanup", () => {
  test("rename cleanup accepts --hints as an alias for --hint", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const filePath = join(fixtureDir, "Screenshot 2026-03-02 at 4.53.04 PM.png");
      await writeFile(filePath, "fake", "utf8");

      const result = runCli(
        [
          "rename",
          "cleanup",
          toRepoRelativePath(filePath),
          "--hints",
          "timestamp",
          "--dry-run",
        ],
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Plan CSV:");
      expect(result.stdout).toContain("Screenshot 20260302-165304.png");
    });
  });
});
