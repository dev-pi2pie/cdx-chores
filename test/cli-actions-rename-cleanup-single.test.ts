import { describe, expect, test } from "bun:test";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameCleanup } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: rename cleanup single-file behavior", () => {
  test("dry-runs a single timestamp cleanup with preserve style", async () => {
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
      expect(stdout.text).toContain(
        "Screenshot 2026-03-02 at 4.53.04 PM.png -> Screenshot 20260302-165304.png",
      );
      expect(stdout.text).toContain("Dry run only. No files were renamed.");

      const entries = await readdir(fixtureDir);
      const planCsv = entries.find((entry) =>
        /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/.test(entry),
      );
      expect(planCsv).toBeDefined();

      const csvText = await readFile(join(fixtureDir, planCsv!), "utf8");
      expect(csvText).toContain("Screenshot 20260302-165304.png");
      expect(csvText).toContain(",Screenshot 20260302-165304,");
    });
  });

  test("applies a single timestamp cleanup with slug style", async () => {
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

  test("removes a matched timestamp when requested", async () => {
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

  test("skips a single file with no timestamp match", async () => {
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
      const planCsv = entries.find((entry) =>
        /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/.test(entry),
      );
      expect(planCsv).toBeDefined();
      const csvText = await readFile(join(fixtureDir, planCsv!), "utf8");
      expect(csvText).toContain(",skipped,no timestamp match,");
    });
  });

  test("dry-runs a single date cleanup with preserve style", async () => {
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

  test("applies a single date cleanup with slug style", async () => {
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

  test("keeps date and timestamp disjoint for date-only hinting", async () => {
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

  test("still cleans standalone date fragments when a timestamp also exists elsewhere", async () => {
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

  test("dry-runs a single serial cleanup with preserve style", async () => {
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
      expect(stdout.text).toContain("scan (12).pdf -> scan.pdf");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    });
  });

  test("applies a single serial cleanup with slug style", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "scan_003.pdf";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["serial"],
        style: "slug",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> scan.pdf`);
      await expect(stat(join(fixtureDir, "scan.pdf"))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("applies serial removal to log-style names", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "app-00001.log";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["serial"],
        style: "slug",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> app.log`);
      await expect(stat(join(fixtureDir, "app.log"))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("does not treat camera-style stems as serial in v1", async () => {
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

  test("does not treat trailing date fragments as serial counters", async () => {
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

  test("dry-runs a single uid cleanup with preserve style", async () => {
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

      const entries = await readdir(fixtureDir);
      const planCsv = entries.find((entry) =>
        /^rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/.test(entry),
      );
      expect(planCsv).toBeDefined();
      const csvText = await readFile(join(fixtureDir, planCsv!), "utf8");
      expect(csvText).toContain(",report final.txt,report final,");
    });
  });

  test("applies uid cleanup with slug style while preserving surrounding text", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "report uid-7k3m9q2x4t final.txt";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["uid"],
        style: "slug",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> report-final.txt`);
      await expect(stat(join(fixtureDir, "report-final.txt"))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("applies uid cleanup with preserve style when matching an existing uid fragment", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "report uid-7k3m9q2x4t final.txt";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["uid"],
        style: "preserve",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> report final.txt`);
      await expect(stat(join(fixtureDir, "report final.txt"))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("skips a single file with no uid match", async () => {
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

  test("resolves single-file existing-target conflicts with number strategy", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "app-00001.log";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");
      await writeFile(join(fixtureDir, "app.log"), "occupied", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["serial"],
        style: "slug",
        conflictStrategy: "number",
      });

      expectNoStderr();
      expect(stdout.text).toContain(`${sourceName} -> app-1.log`);
      await expect(stat(join(fixtureDir, "app-1.log"))).resolves.toBeDefined();
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("resolves single-file existing-target conflicts with uid-suffix strategy", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const sourceName = "app-00001.log";
      const sourcePath = join(fixtureDir, sourceName);
      await writeFile(sourcePath, "fake", "utf8");
      await writeFile(join(fixtureDir, "app.log"), "occupied", "utf8");

      await actionRenameCleanup(runtime, {
        path: sourceName,
        hints: ["serial"],
        style: "slug",
        conflictStrategy: "uid-suffix",
      });

      expectNoStderr();
      expect(stdout.text).toMatch(/app-00001\.log -> app-uid-[0-9a-hjkmnpqrstvwxyz]{10}\.log/);
      const entries = await readdir(fixtureDir);
      expect(entries.some((entry) => /^app-uid-[0-9a-hjkmnpqrstvwxyz]{10}\.log$/.test(entry))).toBe(
        true,
      );
      await expect(stat(sourcePath)).rejects.toBeDefined();
    });
  });

  test("applies timestamp-first behavior when both date and timestamp hints are provided", async () => {
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
      expect(stdout.text).toContain(
        "Screenshot 2026-03-02 at 4.53.04 PM.png -> Screenshot 20260302-165304.png",
      );
    });
  });

  test("applies multiple selected hints sequentially on one filename", async () => {
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
});
