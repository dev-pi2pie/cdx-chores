import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { createTempFixtureDir, runCli } from "../../helpers/cli-test-utils";
import { runRenameCli } from "../support/run-cli";

describe("Rename command UX", () => {
  test("rename help includes template and serial controls", () => {
    const result = runCli(["rename", "batch", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--pattern <template>");
    expect(result.stdout).toContain("{uid}");
    expect(result.stdout).toContain("--prefix <value>");
    expect(result.stdout).toContain("Filename prefix (optional)");
    expect(result.stdout).toContain("--codex");
    expect(result.stdout).toContain("Auto-route eligible files to Codex");
    expect(result.stdout).toContain("--preview-skips <mode>");
    expect(result.stdout).toContain("Skipped-item preview mode: summary or");
    expect(result.stdout).toContain("detailed");
    expect(result.stdout).toContain("--serial-order <value>");
    expect(result.stdout).toContain("--serial-start <value>");
    expect(result.stdout).toContain("--serial-width <value>");
    expect(result.stdout).toContain("--serial-scope <value>");
  });

  test("rename rejects unsupported serial order alias values", () => {
    const result = runCli(["rename", "file", "dummy.txt", "--serial-order", "time_asc"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      "--serial-order must be one of: path_asc, path_desc, mtime_asc, mtime_desc.",
    );
  });

  test("rename batch honors embedded serial start when no CLI override is provided", async () => {
    const fixtureDir = await createTempFixtureDir("cli-ux");
    try {
      const dirPath = join(fixtureDir, "serial-pattern-start");
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, "new-hello.txt"), "hello\n", "utf8");
      await writeFile(join(dirPath, "new-hi.txt"), "hi\n", "utf8");
      await writeFile(join(dirPath, "new-hoho.txt"), "hoho\n", "utf8");

      const result = runRenameCli(fixtureDir, [
        "rename",
        "batch",
        relative(fixtureDir, dirPath),
        "--pattern",
        "{stem}-{serial_start_3}",
        "--dry-run",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("new-hello.txt -> new-hello-3.txt");
      expect(result.stdout).toContain("new-hi.txt -> new-hi-4.txt");
      expect(result.stdout).toContain("new-hoho.txt -> new-hoho-5.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
