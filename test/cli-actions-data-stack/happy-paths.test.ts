import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../../src/cli/actions";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

describe("cli action modules: data stack happy paths", () => {
  test("actionDataStack writes CSV output from mixed explicit and directory sources", async () => {
    await withTempFixtureDir("data-stack-action", async (fixtureDir) => {
      const manualPath = join(fixtureDir, "manual.csv");
      const partsPath = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(partsPath, { recursive: true });
      await writeFile(manualPath, "id,name,status\n1,Ada,active\n", "utf8");
      await writeFile(join(partsPath, "b.csv"), "id,name,status\n3,Cyd,paused\n", "utf8");
      await writeFile(join(partsPath, "a.csv"), "id,name,status\n2,Bob,active\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.csv",
        overwrite: true,
        pattern: "*.csv",
        sources: ["manual.csv", "parts"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV:");
      expect(stderr.text).toContain("Files: 3");
      expect(stderr.text).toContain("Rows: 3");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,name,status\n1,Ada,active\n2,Bob,active\n3,Cyd,paused\n",
      );
    });
  });

  test("actionDataStack writes JSON output for TSV inputs", async () => {
    await withTempFixtureDir("data-stack-action-tsv", async (fixtureDir) => {
      const partsPath = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.json");
      await mkdir(partsPath, { recursive: true });
      await writeFile(join(partsPath, "b.tsv"), "id\tname\tstatus\n5\tEdda\tpaused\n", "utf8");
      await writeFile(join(partsPath, "a.tsv"), "id\tname\tstatus\n4\tDion\tactive\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.json",
        overwrite: true,
        pattern: "*.tsv",
        sources: ["parts"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON:");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "4", name: "Dion", status: "active" },
        { id: "5", name: "Edda", status: "paused" },
      ]);
    });
  });

  test("actionDataStack stacks headerless CSV inputs with generated placeholder names", async () => {
    await withTempFixtureDir("data-stack-action-headerless", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataStack(runtime, {
        noHeader: true,
        output: outputPath,
        overwrite: true,
        sources: [join(REPO_ROOT, "examples/playground/stack-cases/csv-headerless")],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV:");
      expect(await readFile(outputPath, "utf8")).toBe(
        "column_1,column_2,column_3\n2001,active,north\n2002,paused,south\n2003,active,west\n2004,paused,east\n",
      );
    });
  });

  test("actionDataStack stacks headerless TSV inputs with explicit columns", async () => {
    await withTempFixtureDir("data-stack-action-headerless-columns", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataStack(runtime, {
        columns: ["id", "status", "region"],
        noHeader: true,
        output: outputPath,
        overwrite: true,
        sources: [join(REPO_ROOT, "examples/playground/stack-cases/tsv-headerless")],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON:");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "6001", region: "north", status: "active" },
        { id: "6002", region: "south", status: "paused" },
        { id: "6003", region: "west", status: "active" },
        { id: "6004", region: "east", status: "paused" },
      ]);
    });
  });

  test("actionDataStack stacks JSONL inputs with strict same-key handling", async () => {
    await withTempFixtureDir("data-stack-action-jsonl", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataStack(runtime, {
        output: outputPath,
        overwrite: true,
        sources: [join(REPO_ROOT, "examples/playground/stack-cases/jsonl-basic")],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON:");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { action: "login", id: "evt-001", region: "apac", user_id: 41 },
        { action: "view", id: "evt-002", region: "emea", user_id: 42 },
        { action: "purchase", id: "evt-003", region: "amer", user_id: 43 },
        { action: "logout", id: "evt-004", region: "apac", user_id: 44 },
      ]);
    });
  });

  test("actionDataStack stacks JSON array inputs with strict same-key handling", async () => {
    await withTempFixtureDir("data-stack-action-json", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "events");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "day-01.json"),
        JSON.stringify([
          { id: "evt-001", status: "active" },
          { id: "evt-002", status: "paused" },
        ]),
        "utf8",
      );
      await writeFile(
        join(sourceDir, "day-02.json"),
        JSON.stringify([{ status: "active", id: "evt-003" }]),
        "utf8",
      );

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.csv",
        overwrite: true,
        sources: ["events"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV:");
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,status\nevt-001,active\nevt-002,paused\nevt-003,active\n",
      );
    });
  });

  test("actionDataStack excludes an output path that lives inside a scanned directory", async () => {
    await withTempFixtureDir("data-stack-action-output-inside-source", async (fixtureDir) => {
      const partsPath = join(fixtureDir, "parts");
      const outputPath = join(partsPath, "merged.csv");
      await mkdir(partsPath, { recursive: true });
      await writeFile(join(partsPath, "a.csv"), "id,name,status\n1,Ada,active\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "parts/merged.csv",
        overwrite: true,
        sources: ["parts"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV: parts/merged.csv");
      expect(stderr.text).toContain("Files: 1");
      expect(await readFile(outputPath, "utf8")).toBe("id,name,status\n1,Ada,active\n");
    });
  });

  test("actionDataStack normalizes BOM and surrounding header whitespace before matching", async () => {
    await withTempFixtureDir("data-stack-action-normalized-headers", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.json");
      await writeFile(
        join(fixtureDir, "a.csv"),
        "\uFEFFid, name , status \n1,Ada,active\n",
        "utf8",
      );
      await writeFile(join(fixtureDir, "b.csv"), "id,name,status\n2,Bob,paused\n", "utf8");

      const { runtime, expectNoStdout, stderr } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.json",
        overwrite: true,
        sources: ["a.csv", "b.csv"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote JSON: merged.json");
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: "1", name: "Ada", status: "active" },
        { id: "2", name: "Bob", status: "paused" },
      ]);
    });
  });

  test("actionDataStack pads short rows with empty cells during materialization", async () => {
    await withTempFixtureDir("data-stack-action-short-rows", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(join(fixtureDir, "a.csv"), "id,name,status\n1,Ada\n", "utf8");
      await writeFile(join(fixtureDir, "b.csv"), "id,name,status\n2,Bob,paused\n", "utf8");

      const { runtime, expectNoStdout, stderr } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.csv",
        overwrite: true,
        sources: ["a.csv", "b.csv"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Wrote CSV: merged.csv");
      expect(await readFile(outputPath, "utf8")).toBe("id,name,status\n1,Ada,\n2,Bob,paused\n");
    });
  });
});
