import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";

describe("CLI data stack command direct stack execution", () => {
  test("stacks matching-header CSV fixtures end to end", async () => {
    await withTempFixtureDir("data-stack-cli", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");

      const result = runCli([
        "data",
        "stack",
        "examples/playground/stack-cases/csv-matching-headers",
        "--pattern",
        "*.csv",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(result.stderr).toContain("Files: 3");
      expect(result.stderr).toContain("Rows: 6");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,name,status\n1001,Ada,active\n1002,Bao,paused\n1003,Cora,active\n1004,Dion,active\n1005,Edda,paused\n1006,Finn,active\n",
      );
    });
  });

  test("stacks headerless CSV fixtures end to end with generated placeholder names", async () => {
    await withTempFixtureDir("data-stack-cli-headerless", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");

      const result = runCli([
        "data",
        "stack",
        "examples/playground/stack-cases/csv-headerless",
        "--no-header",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe(
        "column_1,column_2,column_3\n2001,active,north\n2002,paused,south\n2003,active,west\n2004,paused,east\n",
      );
    });
  });

  test("stacks headerless TSV fixtures end to end with explicit columns", async () => {
    await withTempFixtureDir("data-stack-cli-headerless-columns", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");

      const result = runCli([
        "data",
        "stack",
        "examples/playground/stack-cases/tsv-headerless",
        "--no-header",
        "--columns",
        "id,status,region",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "6001", region: "north", status: "active" },
        { id: "6002", region: "south", status: "paused" },
        { id: "6003", region: "west", status: "active" },
        { id: "6004", region: "east", status: "paused" },
      ]);
    });
  });

  test("stacks JSONL fixtures end to end", async () => {
    await withTempFixtureDir("data-stack-cli-jsonl", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.tsv");

      const result = runCli([
        "data",
        "stack",
        "examples/playground/stack-cases/jsonl-basic",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id\tuser_id\taction\tregion\nevt-001\t41\tlogin\tapac\nevt-002\t42\tview\temea\nevt-003\t43\tpurchase\tamer\nevt-004\t44\tlogout\tapac\n",
      );
    });
  });

  test("stacks JSON array inputs end to end", async () => {
    await withTempFixtureDir("data-stack-cli-json", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "events");
      const outputPath = join(fixtureDir, "merged.tsv");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "day-01.json"),
        JSON.stringify([{ id: "evt-001", status: "active" }]),
        "utf8",
      );
      await writeFile(
        join(sourceDir, "day-02.json"),
        JSON.stringify([{ status: "paused", id: "evt-002" }]),
        "utf8",
      );

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id\tstatus\nevt-001\tactive\nevt-002\tpaused\n",
      );
    });
  });
});
