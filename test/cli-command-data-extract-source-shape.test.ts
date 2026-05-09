/* oxlint-disable no-unused-vars */
import {
  chmod,
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  createHeaderSuggestionStub,
  seedDataExtractFixtures,
  seedStackedMergedBandFixture,
  REPO_ROOT,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  fixturePath,
  duckdbReady,
  excelReady,
} from "./cli-command-data-extract.helpers";

describe("CLI data extract command source-shape artifacts", () => {
  test("writes a reviewed source-shape artifact and stops before extraction", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      const promptPath = join(fixtureDir, "shape-suggest-prompt.txt");
      const stubPath = await createHeaderSuggestionStub({
        promptPath,
        suggestions: [],
        workingDirectory: fixtureDir,
      });
      await writeFile(
        stubPath,
        `#!/usr/bin/env node
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

await writeFile(${JSON.stringify(promptPath)}, prompt, "utf8");

const response = JSON.stringify({
  header_row: 7,
  range: "B2:E11",
  reasoning_summary: "The clean table starts at worksheet row 7 and spans columns B:E.",
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
`,
        "utf8",
      );
      await chmod(stubPath, 0o755);

      const result = runCli(
        [
          "data",
          "extract",
          toRepoRelativePath(inputPath),
          "--source",
          "Summary",
          "--codex-suggest-shape",
          "--write-source-shape",
          toRepoRelativePath(artifactPath),
        ],
        REPO_ROOT,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Suggested source shape");
      expect(result.stdout).toContain("--range B2:E11");
      expect(result.stdout).toContain("--header-row 7");
      expect(result.stderr).toContain("--source-shape");
      expect(result.stderr).toContain("--codex-suggest-headers");
      expect(result.stderr).toContain("--output");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Selected sheet: Summary");
      expect(prompt).toContain("Current range: (whole sheet)");
      expect(prompt).toContain("Worksheet non-empty row summaries:");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        input: { format: string; path: string; source: string };
        metadata: { artifactType: string };
        shape: { headerRow: number; range: string };
        version: number;
      };
      expect(artifact.version).toBe(1);
      expect(artifact.metadata.artifactType).toBe("data-source-shape");
      expect(artifact.input).toEqual({
        format: "excel",
        path: toRepoRelativePath(inputPath),
        source: "Summary",
      });
      expect(artifact.shape).toEqual({
        headerRow: 7,
        range: "B2:E11",
      });
    });
  });

  test("writes a reviewed body-start-only source-shape artifact and points to header review next", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const artifactPath = join(fixtureDir, "shape-body-only.json");
      const promptPath = join(fixtureDir, "shape-suggest-prompt.txt");
      const stubPath = await createHeaderSuggestionStub({
        promptPath,
        suggestions: [],
        workingDirectory: fixtureDir,
      });
      await writeFile(
        stubPath,
        `#!/usr/bin/env node
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

await writeFile(${JSON.stringify(promptPath)}, prompt, "utf8");

const response = JSON.stringify({
  body_start_row: 10,
  header_row: null,
  range: null,
  reasoning_summary: "The current sheet selection is fine; only the logical body boundary needs to move to worksheet row 10.",
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
`,
        "utf8",
      );
      await chmod(stubPath, 0o755);

      const result = runCli(
        [
          "data",
          "extract",
          toRepoRelativePath(inputPath),
          "--source",
          "Sheet1",
          "--codex-suggest-shape",
          "--write-source-shape",
          toRepoRelativePath(artifactPath),
        ],
        REPO_ROOT,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Suggested source shape");
      expect(result.stdout).toContain("--body-start-row 10");
      expect(result.stderr).toContain("--source-shape");
      expect(result.stderr).toContain("--codex-suggest-headers");

      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
        shape: { bodyStartRow: number };
      };
      expect(artifact.shape).toEqual({
        bodyStartRow: 10,
      });
    });
  });

  test("rejects reviewed source-shape suggestion when --header-row is also provided", async () => {
    const result = runCli([
      "data",
      "extract",
      fixturePath("multi.xlsx"),
      "--source",
      "Summary",
      "--header-row",
      "1",
      "--codex-suggest-shape",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      "--codex-suggest-shape cannot be used together with --header-row",
    );
  });

  test("reuses an accepted source-shape artifact end to end", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      const outputPath = join(fixtureDir, "messy.clean.csv");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-18T00:00:00.000Z",
            },
            shape: {
              headerRow: 7,
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,item,status,description\n1001,Starter,active,Initial package\n1002,Expansion,paused,Requires follow-up\n1003,Renewal,active,Ready to ship\n1004,Archive,draft,Awaiting approval\n",
      );
    });
  });
});
