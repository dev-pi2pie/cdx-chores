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
  fixturePath,
  createHeaderSuggestionStub,
} from "./support";

describe("CLI data query command validation and remediation", () => {
  test("rejects --source together with --relation", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--source",
      "users",
      "--relation",
      "entries=time_entries",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--relation cannot be used together with --source");
  });

  test("rejects duplicate relation aliases in workspace mode", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users",
      "--relation",
      "users=time_entries",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Duplicate workspace relation alias: users");
  });

  test("rejects duplicate relation aliases inside one comma-separated bundle", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users,users=time_entries",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Duplicate workspace relation alias: users");
  });

  test("rejects duplicate relation aliases across repeated and bundled flags", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users",
      "--relation",
      "entries=time_entries,users=active_users",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Duplicate workspace relation alias: users");
  });

  test("rejects --relation for non-workspace query inputs", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--relation",
      "people",
      "--sql",
      "select * from people",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "--relation is currently only supported for SQLite and DuckDB query inputs",
    );
  });

  test("rejects malformed relation aliases at CLI parsing time", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "1bad=users",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--relation alias must be a simple SQL identifier");
  });

  test("rejects empty entries in comma-separated relation bundles at CLI parsing time", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("multi.sqlite"),
      "--relation",
      "users,,entries=time_entries",
      "--sql",
      "select * from users",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--relation bundle cannot contain empty bindings");
  });

  test("reports install-unavailable guidance when SQLite cannot cache extensions", async () => {
    await withTempFixtureDir("query-home-sqlite", async (tempHome) => {
      await chmod(tempHome, 0o500);

      const result = runCli(
        [
          "data",
          "query",
          fixturePath("multi.sqlite"),
          "--source",
          "users",
          "--sql",
          "select * from file",
        ],
        REPO_ROOT,
        { HOME: tempHome },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("requires the DuckDB sqlite extension");
      expect(result.stderr).toContain("cannot install or cache it");
    });
  });

  test("rejects --install-missing-extension for built-in query formats", () => {
    const result = runCli([
      "data",
      "query",
      fixturePath("basic.csv"),
      "--install-missing-extension",
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "--install-missing-extension is only valid for extension-backed query formats",
    );
  });
});
