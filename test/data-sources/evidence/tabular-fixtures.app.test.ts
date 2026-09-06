import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { withTempFixtureDir } from "../../helpers/cli-test-utils";

function runGenerator(outputDir: string): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync({
    cmd: ["node", "scripts/generate-data-extract-fixtures.mjs", "reset", "--output-dir", outputDir],
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
): Promise<Array<{ hash: string; name: string }>> {
  const names = (await readdir(outputDir)).sort();
  const entries = [];
  for (const name of names) {
    const content = await readFile(`${outputDir}/${name}`);
    const hash = createHash("sha256").update(content).digest("hex");
    entries.push({ hash, name });
  }
  return entries;
}

describe("data extract fixture generator", () => {
  test("reset creates a deterministic representative fixture set", async () => {
    await withTempFixtureDir("data-extract-fixtures-a", async (ownerA) => {
      const outputA = join(ownerA, "data");
      await mkdir(outputA);
      await withTempFixtureDir("data-extract-fixtures-b", async (ownerB) => {
        const outputB = join(ownerB, "data");
        await mkdir(outputB);
        const first = runGenerator(outputA);
        const second = runGenerator(outputB);

        expect(first.exitCode).toBe(0);
        expect(second.exitCode).toBe(0);
        expect(first.stdout).toContain("deterministic data extract fixtures");
        expect(second.stdout).toContain("deterministic data extract fixtures");

        const snapshotA = await snapshotDirectory(outputA);
        const snapshotB = await snapshotDirectory(outputB);

        expect(snapshotA).toEqual(snapshotB);
        expect(snapshotA.map((entry) => entry.name)).toEqual([
          "basic.csv",
          "basic.tsv",
          "collapsed-merged.xlsx",
          "generic.csv",
          "header-band.xlsx",
          "messy.xlsx",
          "multi.sqlite",
          "multi.xlsx",
          "no-head.csv",
        ]);
      });
    });
  });
});
