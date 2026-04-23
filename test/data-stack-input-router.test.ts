import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { resolveDataStackInputSources } from "../src/cli/data-stack/input-router";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("data stack input router", () => {
  test("normalizes mixed explicit files and directories in deterministic order", async () => {
    await withTempFixtureDir("data-stack-router", async (fixtureDir) => {
      const directPath = join(fixtureDir, "direct.csv");
      const directoryPath = join(fixtureDir, "parts");
      const outputPath = join(directoryPath, "merged.csv");
      await mkdir(directoryPath, { recursive: true });
      await writeFile(directPath, "id,name\n1,Ada\n", "utf8");
      await writeFile(join(directoryPath, "b.csv"), "id,name\n3,Cyd\n", "utf8");
      await writeFile(join(directoryPath, "a.csv"), "id,name\n2,Bob\n", "utf8");
      await writeFile(join(directoryPath, ".hidden.csv"), "id,name\n9,Skip\n", "utf8");

      const resolved = await resolveDataStackInputSources({
        outputPath,
        pattern: "*.csv",
        sources: [directPath, directoryPath, directPath],
      });

      expect(resolved.files.map((file) => file.path)).toEqual([
        directPath,
        join(directoryPath, "a.csv"),
        join(directoryPath, "b.csv"),
      ]);
      expect(resolved.files.map((file) => file.format)).toEqual(["csv", "csv", "csv"]);
      expect(resolved.files.map((file) => file.sourceKind)).toEqual([
        "file",
        "directory",
        "directory",
      ]);
    });
  });

  test("deduplicates files that are supplied explicitly and also discovered from a directory source", async () => {
    await withTempFixtureDir("data-stack-router-dedupe", async (fixtureDir) => {
      const directoryPath = join(fixtureDir, "parts");
      const explicitPath = join(directoryPath, "a.csv");
      await mkdir(directoryPath, { recursive: true });
      await writeFile(explicitPath, "id,name\n1,Ada\n", "utf8");
      await writeFile(join(directoryPath, "b.csv"), "id,name\n2,Bob\n", "utf8");

      const resolved = await resolveDataStackInputSources({
        sources: [explicitPath, directoryPath],
      });

      expect(resolved.files.map((file) => file.path)).toEqual([
        explicitPath,
        join(directoryPath, "b.csv"),
      ]);
      expect(resolved.files.map((file) => file.sourceKind)).toEqual(["file", "directory"]);
    });
  });

  test("keeps directory discovery shallow by default and applies recursive depth caps only when requested", async () => {
    await withTempFixtureDir("data-stack-router-depth", async (fixtureDir) => {
      const directoryPath = join(fixtureDir, "tree");
      await mkdir(join(directoryPath, "level-1", "level-2"), { recursive: true });
      await writeFile(join(directoryPath, "top.csv"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(directoryPath, "level-1", "inner.csv"), "id,name\n2,Bob\n", "utf8");
      await writeFile(
        join(directoryPath, "level-1", "level-2", "deep.csv"),
        "id,name\n3,Cyd\n",
        "utf8",
      );

      const shallow = await resolveDataStackInputSources({
        sources: [directoryPath],
      });
      const recursive = await resolveDataStackInputSources({
        recursive: true,
        sources: [directoryPath],
      });
      const capped = await resolveDataStackInputSources({
        maxDepth: 1,
        recursive: true,
        sources: [directoryPath],
      });

      expect(shallow.files.map((file) => file.path)).toEqual([join(directoryPath, "top.csv")]);
      expect(recursive.files.map((file) => file.path)).toEqual([
        join(directoryPath, "level-1", "inner.csv"),
        join(directoryPath, "level-1", "level-2", "deep.csv"),
        join(directoryPath, "top.csv"),
      ]);
      expect(capped.files.map((file) => file.path)).toEqual([
        join(directoryPath, "level-1", "inner.csv"),
        join(directoryPath, "top.csv"),
      ]);
    });
  });

  test("rejects unsupported input source kinds such as symlinks", async () => {
    await withTempFixtureDir("data-stack-router-symlink", async (fixtureDir) => {
      const targetPath = join(fixtureDir, "real.csv");
      const symlinkPath = join(fixtureDir, "linked.csv");
      await writeFile(targetPath, "id,name\n1,Ada\n", "utf8");
      await symlink(targetPath, symlinkPath);

      await expect(
        resolveDataStackInputSources({
          sources: [symlinkPath],
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: expect.stringContaining("Unsupported input source kind"),
      });
    });
  });
});
