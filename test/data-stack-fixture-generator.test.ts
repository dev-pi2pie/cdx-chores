import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { fixtureGeneratorInternals } from "../scripts/generate-data-stack-fixtures.mjs";
import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";

function runGenerator(
  command: "seed" | "clean" | "reset",
  outputDir: string,
): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync({
    cmd: ["node", "scripts/generate-data-stack-fixtures.mjs", command, "--output-dir", outputDir],
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  };
}

function runGeneratorWithoutOutputDir(command: "clean" | "reset" | "seed"): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const proc = Bun.spawnSync({
    cmd: ["node", "scripts/generate-data-stack-fixtures.mjs", command],
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  };
}

async function snapshotDirectory(
  outputDir: string,
  prefix = "",
): Promise<Array<{ hash: string; name: string }>> {
  const names = (await readdir(join(outputDir, prefix), { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  const entries = [];
  for (const entry of names) {
    const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      entries.push(...(await snapshotDirectory(outputDir, relativeName)));
      continue;
    }
    const content = await readFile(join(outputDir, relativeName));
    const hash = createHash("sha256").update(content).digest("hex");
    entries.push({ hash, name: relativeName });
  }
  return entries;
}

describe("data stack fixture generator", () => {
  test("reset creates a deterministic representative fixture tree", async () => {
    await withTempFixtureDir("data-stack-fixtures-a", async (outputA) => {
      await withTempFixtureDir("data-stack-fixtures-b", async (outputB) => {
        const first = runGenerator("reset", outputA);
        const second = runGenerator("reset", outputB);

        expect(first.exitCode).toBe(0);
        expect(second.exitCode).toBe(0);
        expect(first.stdout).toContain("deterministic data stack fixtures");
        expect(second.stdout).toContain("deterministic data stack fixtures");

        const snapshotA = await snapshotDirectory(outputA);
        const snapshotB = await snapshotDirectory(outputB);

        expect(snapshotA).toEqual(snapshotB);
        expect(snapshotA.map((entry) => entry.name)).toEqual([
          "csv-header-mismatch/source-a.csv",
          "csv-header-mismatch/source-b.csv",
          "csv-headerless/chunk-001.csv",
          "csv-headerless/chunk-002.csv",
          "csv-matching-headers/part-001.csv",
          "csv-matching-headers/part-002.csv",
          "csv-matching-headers/part-003.csv",
          "jsonl-basic/day-01.jsonl",
          "jsonl-basic/day-02.jsonl",
          "recursive-depth/level-1/branch-a.csv",
          "recursive-depth/level-1/level-2/branch-b.csv",
          "recursive-depth/top-level.csv",
          "tsv-headerless/chunk-001.tsv",
          "tsv-headerless/chunk-002.tsv",
          "tsv-matching-headers/part-001.tsv",
          "tsv-matching-headers/part-002.tsv",
        ]);

        const matchingTsv = await readFile(
          join(outputA, "tsv-matching-headers/part-001.tsv"),
          "utf8",
        );
        expect(matchingTsv).toBe("id\tname\tstatus\n5001\tMina\tactive\n5002\tNico\tpaused\n");

        const headerlessTsv = await readFile(join(outputA, "tsv-headerless/chunk-001.tsv"), "utf8");
        expect(headerlessTsv).toBe("6001\tactive\tnorth\n6002\tpaused\tsouth\n");
      });
    });
  });

  test("seed creates fixtures and clean removes them", async () => {
    await withTempFixtureDir("data-stack-fixtures-seed-clean", async (outputDir) => {
      const seeded = runGenerator("seed", outputDir);
      expect(seeded.exitCode).toBe(0);
      expect(seeded.stdout).toContain("Seeded deterministic data stack fixtures");

      const afterSeed = await snapshotDirectory(outputDir);
      expect(afterSeed.length).toBeGreaterThan(0);

      const cleaned = runGenerator("clean", outputDir);
      expect(cleaned.exitCode).toBe(0);
      expect(cleaned.stdout).toContain("Cleaned");

      await expect(access(outputDir)).rejects.toThrow();
    });
  });

  test("clean refuses to remove the default tracked fixture tree", () => {
    const result = runGeneratorWithoutOutputDir("clean");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Refusing to clean the default tracked stack fixture tree");
    expect(result.stdout).toBe("");
  });

  test("cleanup target policy rejects broad paths before recursive removal", () => {
    expect(() => {
      fixtureGeneratorInternals.assertSafeResetTarget(
        join(fixtureGeneratorInternals.scratchOutputRoot, "safe-case"),
      );
    }).not.toThrow();
    expect(() => {
      fixtureGeneratorInternals.assertSafeResetTarget(fixtureGeneratorInternals.defaultOutputDir);
    }).not.toThrow();

    expect(() => {
      fixtureGeneratorInternals.assertSafeCleanTarget(fixtureGeneratorInternals.defaultOutputDir);
    }).toThrow("Refusing to clean the default tracked stack fixture tree");
    expect(() => {
      fixtureGeneratorInternals.assertSafeResetTarget(REPO_ROOT);
    }).toThrow("Refusing to clean unsafe fixture output directory");
  });
});
