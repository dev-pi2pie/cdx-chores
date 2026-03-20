import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import { seedStackedMergedBandFixture } from "./helpers/stacked-merged-band-fixture-test-utils";
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

  test("extracts CSV input with explicit --no-header and preserves row 1 as data", async () => {
    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "header-row-as-data.csv");
      const outputPath = join(fixtureDir, "header-row-as-data.clean.csv");
      await writeFile(inputPath, "id,name\n1,Ada\n2,Bob\n", "utf8");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--no-header",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("column_1,column_2\nid,name\n1,Ada\n2,Bob\n");
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

  test("extracts an Excel source-shape artifact with reviewed header-row end to end", async () => {
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
        `${JSON.stringify({
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
        }, null, 2)}\n`,
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

  test("extracts a shaped Excel header-band workbook end to end after tolerant import retry", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "header-band.xlsx");
      const outputPath = join(fixtureDir, "header-band.clean.csv");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "Summary",
        "--range",
        "B7:E12",
        "--header-row",
        "7",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,question,status,notes\n101,Confirm tax residency,open,Email pending\n102,Collect withholding certificate,closed,Received\n103,Review dividend statement,open,Waiting on broker\n",
      );
    });
  });

  test("extracts the public stacked merged-band workbook end to end when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const outputPath = join(fixtureDir, "stacked-merged-band.clean.csv");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "Sheet1",
        "--range",
        "B7:BR20",
        "--body-start-row",
        "10",
        "--header-row",
        "7",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,question,status,notes\n1,Does the customer need a follow-up call after the outage review?,- [ ] Yes; - [ ] No,callback\n2,Is there any pending refund evidence that finance still needs to verify?,- [ ] Yes; - [ ] No,refund\n3,Do we already have the replacement tracking number from the warehouse?,- [ ] Yes; - [ ] No,tracking\n4,Did legal approve the latest waiver wording for the support response?,- [ ] Yes; - [ ] No,waiver\n5,Should billing pause the renewal invoice until the dispute is closed?,- [ ] Yes; - [ ] No,renewal\n6,Has the onboarding checklist been resent to the implementation contact?,- [ ] Yes; - [ ] No,onboarding\n7,Do we need another maintenance window before the migration can resume?,- [ ] Yes; - [ ] No,maintenance\n8,Is there a signed change request covering the expanded delivery scope?,- [ ] Yes; - [ ] No,change\n9,Has procurement confirmed the revised purchase order for the hardware?,- [ ] Yes; - [ ] No,procurement\n10,Do we still need security sign-off for the temporary access exception?,- [ ] Yes; - [ ] No,security\n11,Should the account remain in watch status until the next leadership review?,- [ ] Yes; - [ ] No,watch\n",
      );
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
    expect(result.stderr).toContain("--codex-suggest-shape cannot be used together with --header-row");
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
        `${JSON.stringify({
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
        }, null, 2)}\n`,
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
