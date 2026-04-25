import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  readDataStackPlanArtifact,
  serializeDataStackPlanArtifact,
} from "../src/cli/data-stack/plan";
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

  test("supports --union-by-name and --exclude-columns from the command layer", async () => {
    await withTempFixtureDir("data-stack-cli-union", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "a.csv"), "id,name,noise\n1,Ada,drop-a\n", "utf8");
      await writeFile(join(sourceDir, "b.csv"), "id,status,noise\n2,active,drop-b\n", "utf8");

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--union-by-name",
        "--exclude-columns",
        "noise",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Schema mode: union-by-name");
      expect(result.stderr).toContain("Excluded columns: 1 (noise)");
      expect(await readFile(outputPath, "utf8")).toBe("id,name,status\n1,Ada,\n2,,active\n");
    });
  });

  test("writes a custom dry-run plan without stack output from the command layer", async () => {
    await withTempFixtureDir("data-stack-cli-dry-run", async (fixtureDir) => {
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n1,paused\n", "utf8");

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(join(fixtureDir, "a.csv")),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--unique-by",
        "id",
        "--on-duplicate",
        "report",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Dry run: wrote stack plan ${toRepoRelativePath(planPath)}`);
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      const plan = await readDataStackPlanArtifact(planPath);
      expect(plan.duplicates.duplicateKeyConflicts).toBe(1);
      expect(plan.duplicates.policy).toBe("report");
    });
  });

  test("supports comma-separated composite unique keys from the command layer", async () => {
    await withTempFixtureDir("data-stack-cli-composite-unique", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(
        sourcePath,
        "region,day,status\napac,mon,active\napac,mon,paused\napac,,draft\n",
        "utf8",
      );

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--unique-by",
        "region,day",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Unique key: region, day");
      expect(result.stderr).toContain("Duplicate key conflicts: 1");
      expect(result.stderr).toContain("Null key rows: 1");
      const plan = await readDataStackPlanArtifact(planPath);
      expect(plan.duplicates.uniqueBy).toEqual(["region", "day"]);
      expect(plan.duplicates.duplicateKeyConflicts).toBe(1);
    });
  });

  test("rejects unknown duplicate policies from the command layer", () => {
    const result = runCli([
      "data",
      "stack",
      "examples/playground/stack-cases/csv-matching-headers",
      "--output",
      "examples/playground/.tmp-tests/invalid.csv",
      "--on-duplicate",
      "drop",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--on-duplicate must be one of");
  });

  test("replays a dry-run stack plan", async () => {
    await withTempFixtureDir("data-stack-cli-replay", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n2,paused\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(0);
      expect(replay.stdout).toBe("");
      expect(replay.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1,active\n2,paused\n");
    });
  });

  test("replay supports output override and auto-clean", async () => {
    await withTempFixtureDir("data-stack-cli-replay-override", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const originalOutputPath = join(fixtureDir, "merged.csv");
      const overrideOutputPath = join(fixtureDir, "override.json");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(originalOutputPath),
        "--overwrite",
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli([
        "data",
        "stack",
        "replay",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(overrideOutputPath),
        "--auto-clean",
      ]);

      expect(replay.exitCode).toBe(0);
      expect(JSON.parse(await readFile(overrideOutputPath, "utf8"))).toEqual([
        { id: "1", status: "active" },
      ]);
      await expect(readFile(originalOutputPath, "utf8")).rejects.toThrow();
      await expect(readFile(planPath, "utf8")).rejects.toThrow();
    });
  });

  test("replay refuses to write output over its own plan artifact", async () => {
    await withTempFixtureDir("data-stack-cli-replay-self-overwrite", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli([
        "data",
        "stack",
        "replay",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(planPath),
      ]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Replay output path cannot be the stack-plan record path");
      expect((await readDataStackPlanArtifact(planPath)).metadata.artifactType).toBe(
        "data-stack-plan",
      );
    });
  });

  test("replay fails clearly when no output path is available", async () => {
    await withTempFixtureDir("data-stack-cli-replay-missing-output", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);
      expect(dryRun.exitCode).toBe(0);

      const plan = await readDataStackPlanArtifact(planPath);
      await writeFile(
        planPath,
        serializeDataStackPlanArtifact({
          ...plan,
          output: {
            ...plan.output,
            path: null,
          },
        }),
        "utf8",
      );

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Replay requires an output path");
    });
  });

  test("replay warns on fingerprint drift", async () => {
    await withTempFixtureDir("data-stack-cli-replay-drift", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);
      expect(dryRun.exitCode).toBe(0);
      await writeFile(sourcePath, "id,status\n1,active\n2,paused\n", "utf8");

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(0);
      expect(replay.stderr).toContain("Warning: source fingerprint changed");
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1,active\n2,paused\n");
    });
  });

  test("replay enforces stored reject duplicate policy", async () => {
    await withTempFixtureDir("data-stack-cli-replay-duplicate-reject", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n1,paused\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--unique-by",
        "id",
        "--on-duplicate",
        "reject",
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Replay duplicate key conflicts found");
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
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

  test("honors --input-format json for extensionless directory matches", async () => {
    await withTempFixtureDir("data-stack-cli-json-override", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "events");
      const outputPath = join(fixtureDir, "merged.json");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "day-01.data"),
        JSON.stringify([{ id: "evt-001", status: "active" }]),
        "utf8",
      );
      await writeFile(
        join(sourceDir, "day-02.data"),
        JSON.stringify([{ id: "evt-002", status: "paused" }]),
        "utf8",
      );

      const result = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourceDir),
        "--pattern",
        "*.data",
        "--input-format",
        "json",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "evt-001", status: "active" },
        { id: "evt-002", status: "paused" },
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
