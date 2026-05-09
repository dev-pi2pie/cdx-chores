import {
  chmod,
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  runCli,
  withTempFixtureDir,
  duckdbReady,
  excelReady,
  sqliteReady,
  createCodexStub,
} from "./cli-command-data-query-codex.helpers";

describe("CLI data query codex command workspace", () => {
  test("accepts --relation on the codex lane for SQLite workspace inputs", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
        summary: "Uses the selected SQLite workspace relations.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "users",
          "--relation",
          "entries=time_entries",
          "--intent",
          "join users with time entries",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Relations: users, entries");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Use only these relation names: users, entries.");
      expect(prompt).toContain("Relation users (source: users)");
      expect(prompt).toContain("Relation entries (source: time_entries)");
      expect(prompt).toContain("1. entry_id: BIGINT");
      expect(prompt).toContain("3. hours: BIGINT");
      expect(prompt).toContain('"entry_id":"1"');
    });
  });

  test("accepts inline --relation=<binding> syntax on the codex workspace lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-inline-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.id, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
        summary: "Uses inline workspace relation bindings.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation=users",
          "--relation=entries=time_entries",
          "--intent",
          "join users with time entries",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Relations: users, entries");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Use only these relation names: users, entries.");
      expect(prompt).toContain("Relation entries (source: time_entries)");
    });
  });

  test("accepts comma-separated --relation bundles on the codex workspace lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-bundled-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.id, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
        summary: "Uses bundled workspace relation bindings.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "users,entries=time_entries",
          "--intent",
          "join users with time entries",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Relations: users, entries");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Use only these relation names: users, entries.");
      expect(prompt).toContain("Relation entries (source: time_entries)");
    });
  });

  test("accepts DuckDB workspace relations on the codex lane", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const promptPath = join(fixtureDir, "duckdb-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id",
        summary: "Uses DuckDB workspace relations.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          inputPath,
          "--relation",
          "users",
          "--relation",
          "events=analytics.events",
          "--intent",
          "join users with analytics events",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Format: duckdb");
      expect(result.stdout).toContain("Relations: users, events");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Detected format: duckdb");
      expect(prompt).toContain("Relation events (source: analytics.events)");
    });
  });

  test("prints SQL only for SQLite workspace codex drafting", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const stubPath = await createCodexStub({
        sql: "select users.id, entries.hours from users join entries on users.id = entries.entry_id",
        summary: "unused in print-sql mode",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "users",
          "--relation",
          "entries=time_entries",
          "--intent",
          "join users with time entries",
          "--print-sql",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.trim()).toBe(
        "select users.id, entries.hours from users join entries on users.id = entries.entry_id",
      );
    });
  });

  test("allows explicit file aliases on the codex workspace lane", async () => {
    if (!sqliteReady) {
      return;
    }

    await withTempFixtureDir("query-codex-cli", async (fixtureDir) => {
      const promptPath = join(fixtureDir, "sqlite-file-workspace-prompt.txt");
      const stubPath = await createCodexStub({
        promptPath,
        sql: "select id, name from file order by id",
        summary: "Uses the explicit workspace alias file.",
        workingDirectory: fixtureDir,
      });

      const result = runCli(
        [
          "data",
          "query",
          "codex",
          "test/fixtures/data-query/multi.sqlite",
          "--relation",
          "file=users",
          "--intent",
          "list users",
        ],
        undefined,
        { CDX_CHORES_CODEX_PATH: stubPath },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Relations: file");

      const prompt = await readFile(promptPath, "utf8");
      expect(prompt).toContain("Use only these relation names: file.");
      expect(prompt).toContain("Relation file (source: users)");
    });
  });
});
