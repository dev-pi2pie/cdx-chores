import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";

import { actionDataPreview } from "../src/cli/actions";
import { createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;
const stripAnsi = (value: string) => value.replace(ANSI_PATTERN, "");

function enableTty(runtime: { stdout: NodeJS.WritableStream }, columns: number): void {
  const stream = runtime.stdout as NodeJS.WritableStream & { columns?: number; isTTY?: boolean };
  stream.isTTY = true;
  stream.columns = columns;
}

describe("cli action modules: data preview", () => {
  test("actionDataPreview renders CSV summary and table output", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, "name,age\nAda,36\nBob,28\n", "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).toContain(`Input: ${toRepoRelativePath(inputPath)}`);
      expect(stdout.text).toContain("Format: csv");
      expect(stdout.text).toContain("Rows: 2");
      expect(stdout.text).toContain("Window: 1-2 of 2");
      expect(stdout.text).toContain("Visible columns: name, age");
      expect(stdout.text).toContain("name | age");
      expect(stdout.text).toContain("Ada  | 36 ");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview preserves first-seen key order across heterogeneous JSON rows", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.json");
      await writeFile(
        inputPath,
        '[{"name":"Ada","age":36},{"name":"Bob","status":"active"},{"status":"pending","city":"Taipei"}]\n',
        "utf8",
      );

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: name, age, status, city");
      expect(stdout.text).toContain("name | age | status");
      expect(stdout.text).toContain("city");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview uses value column fallback for scalar arrays", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "scalar-array.json");
      await writeFile(inputPath, '["Ada", 36, true]\n', "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: value");
      expect(stdout.text).toContain("value");
      expect(stdout.text).toContain("Ada");
      expect(stdout.text).toContain("36");
      expect(stdout.text).toContain("true");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview normalizes blank CSV headers and extends rows wider than the header", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "odd.csv");
      await writeFile(inputPath, "name,\nAda,36,admin\n", "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).toContain("Visible columns: name, column_2, column_3");
      expect(stdout.text).toContain("name | column_2 | column_3");
      expect(stdout.text).toContain("Ada");
      expect(stdout.text).toContain("36");
      expect(stdout.text).toContain("admin");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview reports empty CSV deterministically", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "empty.csv");
      await writeFile(inputPath, "", "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).toContain("Rows: 0");
      expect(stdout.text).toContain("Window: 0 rows at offset 0");
      expect(stdout.text).toContain("Visible columns: (none)");
      expect(stdout.text).toContain("(no columns to display)");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview applies column filtering and row windowing", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "window.json");
      await writeFile(
        inputPath,
        '[{"id":1,"name":"Ada","status":"active"},{"id":2,"name":"Bob","status":"paused"},{"id":3,"name":"Cyd","status":"draft"}]\n',
        "utf8",
      );

      await actionDataPreview(runtime, {
        columns: ["id", "status"],
        input: toRepoRelativePath(inputPath),
        offset: 1,
        rows: 1,
      });

      expectNoStderr();
      expect(stdout.text).toContain("Window: 2-2 of 3");
      expect(stdout.text).toContain("Visible columns: id, status");
      expect(stdout.text).toContain("paused");
      expect(stdout.text).not.toContain("Ada");
      expect(stdout.text).not.toContain("draft");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview bounds visible columns in narrow TTY mode", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      enableTty(runtime, 18);
      const inputPath = join(fixtureDir, "wide.csv");
      await writeFile(inputPath, "id,status,message,owner,region\n1,ok,hello,ada,tw\n", "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      const plain = stripAnsi(stdout.text);
      expect(plain).toContain("Visible columns: id, status, message (+2 hidden)");
      expect(plain).toContain("id  | status | me...");
      expect(plain).not.toContain("owner");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview styles summary labels and header cells in TTY mode", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      enableTty(runtime, 80);
      const inputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).toMatch(ANSI_PATTERN);
      expect(stripAnsi(stdout.text)).toContain("Input");
      expect(stripAnsi(stdout.text)).toContain("name");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview omits ANSI styling in TTY mode when color is disabled", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
      enableTty(runtime, 80);
      const inputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");

      await actionDataPreview(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      expectNoStderr();
      expect(stdout.text).not.toMatch(ANSI_PATTERN);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});

describe("cli action modules: data preview failure modes", () => {
  test("actionDataPreview rejects unsupported file types", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.txt");
      await writeFile(inputPath, "name\nAda\n", "utf8");

      await expectCliError(
        () => actionDataPreview(runtime, { input: toRepoRelativePath(inputPath) }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Unsupported preview file type:" },
      );

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview rejects unknown requested columns", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "rows.csv");
      await writeFile(inputPath, "name,age\nAda,36\n", "utf8");

      await expectCliError(
        () => actionDataPreview(runtime, { input: toRepoRelativePath(inputPath), columns: ["status"] }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Unknown columns: status" },
      );

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview rejects malformed CSV input", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "broken.csv");
      await writeFile(inputPath, '"name","age"\n"Ada","36\n', "utf8");

      await expectCliError(
        () => actionDataPreview(runtime, { input: toRepoRelativePath(inputPath) }),
        { code: "INVALID_CSV", exitCode: 2, messageIncludes: "Invalid CSV:" },
      );

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionDataPreview rejects malformed JSON input", async () => {
    const fixtureDir = await createTempFixtureDir("data-preview");
    try {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "broken.json");
      await writeFile(inputPath, '{"name":"Ada"\n', "utf8");

      await expectCliError(
        () => actionDataPreview(runtime, { input: toRepoRelativePath(inputPath) }),
        { code: "INVALID_JSON", exitCode: 2, messageIncludes: "Invalid JSON:" },
      );

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
