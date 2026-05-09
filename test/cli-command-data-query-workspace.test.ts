/* oxlint-disable no-unused-vars */
import {
  chmod,
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDataExtractFixtures,
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbQuotedCommaSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  seedStackedMergedBandFixture,
  REPO_ROOT,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  duckdbReady,
  sqliteReady,
  excelReady,
  fixturePath,
  createHeaderSuggestionStub,
} from "./cli-command-data-query.helpers";

describe("CLI data query command SQLite workspace sources", () => {
  test("queries SQLite input end to end when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--source",
      "users",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: sqlite");
    expect(result.stdout).toContain("Source: users");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("queries SQLite workspace relations end to end when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users",
      "--relation",
      "entries=time_entries",
      "--sql",
      "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Format: sqlite");
    expect(result.stdout).toContain("Relations: users, entries");
    expect(result.stdout).toContain("Ada  | 8");
    expect(result.stdout).toContain("Bob  | 5");
  });

  test("treats one explicit --relation binding as workspace mode when the extension is ready", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "people=users",
      "--sql",
      "select id, name from people order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Relations: people");
    expect(result.stdout).not.toContain("Source: users");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("allows explicit file aliases in workspace mode", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "file=users",
      "--sql",
      "select id, name from file order by id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Relations: file");
    expect(result.stdout).not.toContain("Source: users");
    expect(result.stdout).toContain("1   | Ada");
  });

  test("accepts comma-separated --relation bundles", () => {
    if (!sqliteReady) {
      return;
    }

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users,entries=time_entries",
      "--sql",
      "select users.name, entries.hours from users join entries on users.id = entries.entry_id order by users.id",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Relations: users, entries");
    expect(result.stdout).toContain("Ada  | 8");
    expect(result.stdout).toContain("Bob  | 5");
  });
});
