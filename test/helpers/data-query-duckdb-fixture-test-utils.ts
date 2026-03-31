import { rm } from "node:fs/promises";
import { join } from "node:path";

export async function seedDuckDbWorkspaceFixture(outputDir: string): Promise<string> {
  const { DuckDBConnection } = await import("@duckdb/node-api");

  const outputPath = join(outputDir, "multi.duckdb");
  await rm(outputPath, { force: true });

  const connection = await DuckDBConnection.create();
  try {
    await connection.run(`attach '${outputPath.replaceAll("'", "''")}' as fixture`);
    await connection.run("create schema fixture.analytics");
    await connection.run(
      "create table fixture.main.users(id integer, name varchar, status varchar)",
    );
    await connection.run(
      "insert into fixture.main.users values (1, 'Ada', 'active'), (2, 'Bob', 'paused'), (3, 'Cyd', 'active')",
    );
    await connection.run(
      "create table fixture.main.time_entries(entry_id integer, team varchar, hours bigint)",
    );
    await connection.run(
      "insert into fixture.main.time_entries values (1, 'Core', 8), (2, 'Infra', 5), (3, 'Core', 3)",
    );
    await connection.run("create table fixture.main.file(user_id integer, note varchar)");
    await connection.run(
      "insert into fixture.main.file values (1, 'welcome'), (2, 'paused-review'), (3, 'follow-up')",
    );
    await connection.run(
      "create table fixture.analytics.events(id integer, user_id integer, event_type varchar)",
    );
    await connection.run(
      "insert into fixture.analytics.events values (10, 1, 'login'), (11, 1, 'export'), (12, 2, 'login')",
    );
    await connection.run("checkpoint");
    await connection.run("detach fixture");
  } finally {
    connection.closeSync();
  }

  return outputPath;
}
