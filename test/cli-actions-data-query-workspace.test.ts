import {
  describe,
  expect,
  test,
  readFile,
  writeFile,
  join,
  actionDataQuery,
  getDisplayWidth,
  createDuckDbConnection,
  listDataQuerySources,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  REPO_ROOT,
  toRepoRelativePath,
  withTempFixtureDir,
  seedStackedMergedBandFixture,
  dataQueryFixturePath,
  TtyCaptureStream,
  duckdbReady,
  excelReady,
  sqliteReady,
} from "./cli-actions-data-query.helpers";

describe("cli action modules: data query source and workspace resolution", () => {
  test("actionDataQuery renders bounded table output for SQLite workspace relations", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: toRepoRelativePath(dataQueryFixturePath("multi.sqlite")),
      relations: [
        { alias: "users", source: "users" },
        { alias: "entries", source: "time_entries" },
      ],
      sql: "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Format: sqlite");
    expect(stdout.text).toContain("Relations: users, entries");
    expect(stdout.text).toContain("Ada  | 8");
    expect(stdout.text).toContain("Bob  | 5");
  });

  test("actionDataQuery treats one explicit relation binding as workspace mode", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: toRepoRelativePath(dataQueryFixturePath("multi.sqlite")),
      relations: [{ alias: "people", source: "users" }],
      sql: "select id, name from people order by id",
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Relations: people");
    expect(stdout.text).not.toContain("Source: users");
    expect(stdout.text).toContain("1   | Ada");
  });

  test("actionDataQuery renders bounded table output for DuckDB-file inputs", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        source: "users",
        sql: "select id, name from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Source: users");
      expect(stdout.text).toContain("1   | Ada");
      expect(stdout.text).toContain("2   | Bob");
    });
  });

  test("actionDataQuery infers the only DuckDB source when the file has one table", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        sql: "select id, name from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Source: users");
      expect(stdout.text).toContain("1   | Ada");
      expect(stdout.text).toContain("2   | Bob");
    });
  });

  test("actionDataQuery supports schema-qualified DuckDB sources", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        source: "analytics.events",
        sql: "select id, event_type from file order by id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Source: analytics.events");
      expect(stdout.text).toContain("10  | login");
      expect(stdout.text).toContain("11  | export");
    });
  });

  test("actionDataQuery renders bounded table output for DuckDB workspace relations", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);

      const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
      await actionDataQuery(runtime, {
        input: toRepoRelativePath(inputPath),
        relations: [
          { alias: "users", source: "users" },
          { alias: "events", source: "analytics.events" },
        ],
        sql: "select users.name, events.event_type from users join events on users.id = events.user_id order by events.id",
      });

      expectNoStderr();
      expect(stderr.text).toBe("");
      expect(stdout.text).toContain("Format: duckdb");
      expect(stdout.text).toContain("Relations: users, events");
      expect(stdout.text).toContain("Ada  | login");
      expect(stdout.text).toContain("Ada  | export");
    });
  });

  test("actionDataQuery keeps dotted DuckDB source names selectable without collisions", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedAmbiguousDuckDbSourceFixture(fixtureDir);
      const connection = await createDuckDbConnection();
      try {
        const sources = await listDataQuerySources(connection, inputPath, "duckdb");
        expect(sources).toEqual(["analytics.events", '"analytics.events"']);
      } finally {
        connection.closeSync();
      }

      const mainSourceRun = createActionTestRuntime();
      await actionDataQuery(mainSourceRun.runtime, {
        input: toRepoRelativePath(inputPath),
        source: '"analytics.events"',
        sql: "select id, scope from file",
      });
      mainSourceRun.expectNoStderr();
      expect(mainSourceRun.stdout.text).toContain('"analytics.events"');
      expect(mainSourceRun.stdout.text).toContain("1   | main-table");

      const schemaSourceRun = createActionTestRuntime();
      await actionDataQuery(schemaSourceRun.runtime, {
        input: toRepoRelativePath(inputPath),
        source: "analytics.events",
        sql: "select id, scope from file",
      });
      schemaSourceRun.expectNoStderr();
      expect(schemaSourceRun.stdout.text).toContain("Source: analytics.events");
      expect(schemaSourceRun.stdout.text).toContain("2   | schema-table");
    });
  });

  test("actionDataQuery rejects --source together with --relation before query execution", async () => {
    const { runtime } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          relations: [{ alias: "entries", source: "time_entries" }],
          source: "users",
          sql: "select * from file",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--relation cannot be used together with --source",
      },
    );
  });

  test("actionDataQuery allows explicit file aliases in workspace mode", async () => {
    if (!sqliteReady) {
      return;
    }

    const { runtime, stdout, stderr, expectNoStderr } = createActionTestRuntime();
    await actionDataQuery(runtime, {
      input: "test/fixtures/data-query/multi.sqlite",
      relations: [{ alias: "file", source: "users" }],
      sql: "select id, name from file order by id",
    });

    expectNoStderr();
    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Relations: file");
    expect(stdout.text).toContain("1   | Ada");
  });

  test("actionDataQuery rejects duplicate relation aliases in workspace mode", async () => {
    const { runtime } = createActionTestRuntime();

    await expectCliError(
      () =>
        actionDataQuery(runtime, {
          input: "test/fixtures/data-query/multi.sqlite",
          relations: [
            { alias: "users", source: "users" },
            { alias: "users", source: "time_entries" },
          ],
          sql: "select * from users",
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Duplicate workspace relation alias: users",
      },
    );
  });

  test("actionDataQuery reports unknown DuckDB sources clearly", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const { runtime } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataQuery(runtime, {
            input: toRepoRelativePath(inputPath),
            source: "analytics.missing",
            sql: "select * from file",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown DuckDB source: analytics.missing",
        },
      );
    });
  });
});
