import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { REPO_ROOT, runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

const queryExtensions = await inspectDataQueryExtensions();
const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;

function fixturePath(name: string): string {
  return join("test", "fixtures", "data-query", name);
}

async function createHeaderSuggestionStub(options: {
  promptPath?: string;
  suggestions: Array<{ from: string; to: string }>;
  workingDirectory: string;
}): Promise<string> {
  const stubPath = join(options.workingDirectory, "header-suggest-stub.mjs");
  const promptWrite =
    options.promptPath
      ? `await writeFile(${JSON.stringify(options.promptPath)}, prompt, "utf8");`
      : "";
  const script = `#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const prompt = await new Promise((resolve, reject) => {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    text += chunk;
  });
  process.stdin.on("end", () => resolve(text));
  process.stdin.on("error", reject);
});

${promptWrite}

const response = JSON.stringify({
  suggestions: ${JSON.stringify(options.suggestions)},
});

process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-thread" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.started" }) + "\\n");
process.stdout.write(JSON.stringify({
  type: "item.completed",
  item: { id: "msg-1", type: "agent_message", text: response },
}) + "\\n");
process.stdout.write(JSON.stringify({
  type: "turn.completed",
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
}) + "\\n");
`;

  await writeFile(stubPath, script, "utf8");
  await chmod(stubPath, 0o755);
  return stubPath;
}

describe("CLI data extract command", () => {
  test("extracts CSV input end to end", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "basic.json");

      const result = runCli([
        "data",
        "extract",
        fixturePath("basic.csv"),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { created_at: "2026-03-01", id: "1", name: "Ada", status: "active" },
        { created_at: "2026-03-02", id: "2", name: "Bob", status: "paused" },
        { created_at: "2026-03-03", id: "3", name: "Cyd", status: "draft" },
      ]);
    });
  });

  test("extracts an explicit Excel range end to end when the extension is ready", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "summary.tsv");

      const result = runCli([
        "data",
        "extract",
        fixturePath("multi.xlsx"),
        "--source",
        "Summary",
        "--range",
        "A1:B3",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote TSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id\tname\n1\tAda\n2\tBob\n");
    });
  });

  test("writes a reviewed header-mapping artifact and stops before extraction", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      const promptPath = join(fixtureDir, "header-suggest-prompt.txt");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      const stubPath = await createHeaderSuggestionStub({
        promptPath,
        suggestions: [
          { from: "column_1", to: "id" },
          { from: "column_2", to: "status" },
        ],
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "extract",
          toRepoRelativePath(inputPath),
          "--codex-suggest-headers",
          "--write-header-mapping",
          toRepoRelativePath(artifactPath),
        ],
        REPO_ROOT,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Suggested headers");
      expect(result.stdout).toContain("column_1 -> id");
      expect(result.stdout).toContain("column_2 -> status");
      expect(result.stderr).toContain("--header-mapping");
      expect(result.stderr).toContain("--output");
      expect(result.stderr).toContain("data extract");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Detected format: csv");
      expect(prompt).toContain("1. column_1 (BIGINT) samples: 1001, 1002");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string };
        mappings: Array<{ from: string; inferredType?: string; sample?: string; to: string }>;
      };
      expect(artifact.input).toEqual({
        format: "csv",
        path: toRepoRelativePath(inputPath),
      });
      expect(artifact.mappings).toEqual([
        { from: "column_1", inferredType: "BIGINT", sample: "1001", to: "id" },
        { from: "column_2", inferredType: "VARCHAR", sample: "active", to: "status" },
      ]);
    });
  });

  test("reuses an accepted header-mapping artifact end to end", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "generic.csv");
      const artifactPath = join(fixtureDir, "header-map.json");
      const outputPath = join(fixtureDir, "generic.clean.csv");
      await writeFile(inputPath, "column_1,column_2\n1001,active\n1002,paused\n", "utf8");
      await writeFile(
        artifactPath,
        `${JSON.stringify({
          input: {
            format: "csv",
            path: toRepoRelativePath(inputPath),
          },
          mappings: [
            { from: "column_1", to: "id" },
            { from: "column_2", to: "status" },
          ],
          metadata: {
            artifactType: "data-header-mapping",
            issuedAt: "2026-03-18T00:00:00.000Z",
          },
          version: 1,
        }, null, 2)}\n`,
        "utf8",
      );

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--header-mapping",
        toRepoRelativePath(artifactPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1001,active\n1002,paused\n");
    });
  });
});
