import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("CLI data stack command", () => {
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

  test("honors --input-format jsonl for extensionless directory matches", async () => {
    await withTempFixtureDir("data-stack-cli-jsonl-override", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "events");
      const outputPath = join(fixtureDir, "merged.json");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "day-01.data"),
        '{"id":"evt-001","status":"active"}\n{"id":"evt-002","status":"paused"}\n',
        "utf8",
      );
      await writeFile(
        join(sourceDir, "day-02.data"),
        '{"id":"evt-003","status":"active"}\n',
        "utf8",
      );

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--pattern",
        "*.data",
        "--input-format",
        "jsonl",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "evt-001", status: "active" },
        { id: "evt-002", status: "paused" },
        { id: "evt-003", status: "active" },
      ]);
    });
  });

  test("honors --input-format for extensionless directory matches", async () => {
    await withTempFixtureDir("data-stack-cli-override", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "part-a.data"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(sourceDir, "part-b.data"), "id,name\n2,Bob\n", "utf8");

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--pattern",
        "*.data",
        "--input-format",
        "csv",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe("id,name\n1,Ada\n2,Bob\n");
    });
  });

  test("respects shallow-by-default traversal and opt-in recursion", async () => {
    await withTempFixtureDir("data-stack-cli-depth", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "tree");
      const shallowOutputPath = join(fixtureDir, "shallow.csv");
      const recursiveOutputPath = join(fixtureDir, "recursive.csv");
      await mkdir(join(sourceDir, "nested"), { recursive: true });
      await writeFile(join(sourceDir, "top.csv"), "id,name\n1,Ada\n", "utf8");
      await writeFile(join(sourceDir, "nested", "inner.csv"), "id,name\n2,Bob\n", "utf8");

      const shallow = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--output",
        toRepoRelativePath(shallowOutputPath),
        "--overwrite",
      ]);
      const recursive = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--recursive",
        "--output",
        toRepoRelativePath(recursiveOutputPath),
        "--overwrite",
      ]);

      expect(shallow.exitCode).toBe(0);
      expect(recursive.exitCode).toBe(0);
      expect(await readFile(shallowOutputPath, "utf8")).toBe("id,name\n1,Ada\n");
      expect(await readFile(recursiveOutputPath, "utf8")).toBe("id,name\n2,Bob\n1,Ada\n");
    });
  });

  test("rejects --max-depth without --recursive", async () => {
    const result = runCli([
      "data",
      "stack",
      "examples/playground/stack-cases/csv-matching-headers",
      "--max-depth",
      "1",
      "--output",
      "examples/playground/.tmp-tests/invalid.csv",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--max-depth requires --recursive");
  });

  test("rejects --columns without --no-header at the command layer", () => {
    const result = runCli([
      "data",
      "stack",
      "examples/playground/stack-cases/csv-matching-headers",
      "--columns",
      "id,name,status",
      "--output",
      "examples/playground/.tmp-tests/invalid.csv",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--columns requires --no-header");
  });
});
