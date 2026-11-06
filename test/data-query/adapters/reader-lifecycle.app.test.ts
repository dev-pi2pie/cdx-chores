import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  executeDataQueryForAllRows,
  executeDataQueryForTable,
} from "../../../src/cli/duckdb/query/execute";
import {
  createDuckDbConnection,
  escapeSqlStringLiteral,
} from "../../../src/cli/duckdb/query/formats";
import {
  collectDataQuerySourceIntrospection,
  collectDataQueryWorkspaceIntrospection,
} from "../../../src/cli/duckdb/query/introspection";
import { seedDuckDbWorkspaceFixture } from "../../data-sources/fixtures/duckdb";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { requireNativePrerequisites } from "../../helpers/native-prerequisites";

describe("DuckDB bounded reader reuse", () => {
  test("reuses a connection after bounded, empty, and failed table queries", async () => {
    await requireNativePrerequisites("duckdb");
    const connection = await createDuckDbConnection();
    try {
      const bounded = await executeDataQueryForTable(
        connection,
        "select range as id from range(10000)",
        2,
      );
      expect(bounded).toEqual({
        columns: ["id"],
        rows: [{ values: { id: "0" } }, { values: { id: "1" } }],
        truncated: true,
      });
      expect(await executeDataQueryForTable(connection, "select 42 as answer", 2)).toEqual({
        columns: ["answer"],
        rows: [{ values: { answer: "42" } }],
        truncated: false,
      });
      expect(
        await executeDataQueryForTable(connection, "select 1::bigint as id where false", 2),
      ).toEqual({ columns: ["id"], rows: [], truncated: false });
      await expect(
        executeDataQueryForTable(connection, "select missing_column", 2),
      ).rejects.toMatchObject({ code: "DATA_QUERY_FAILED", exitCode: 2 });
      expect((await executeDataQueryForAllRows(connection, "select 7 as recovered")).rows).toEqual([
        { recovered: 7 },
      ]);
    } finally {
      connection.closeSync();
    }
  });

  test("captures source schema and releases its partial preview before querying", async () => {
    await requireNativePrerequisites("duckdb");
    await withTempFixtureDir("query-source-reader", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "large.csv");
      await writeFile(
        inputPath,
        "id,name\n" + Array.from({ length: 10000 }, (_, id) => `${id},member`).join("\n") + "\n",
      );
      const connection = await createDuckDbConnection();
      try {
        const result = await collectDataQuerySourceIntrospection(
          connection,
          inputPath,
          "csv",
          {},
          2,
        );
        expect(result.columns).toEqual([
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ]);
        expect(result.sampleRows).toEqual([
          { id: "0", name: "member" },
          { id: "1", name: "member" },
        ]);
        expect(result.truncated).toBe(true);
        expect(
          (await executeDataQueryForAllRows(connection, "select count(*) as count from file")).rows,
        ).toEqual([{ count: "10000" }]);
      } finally {
        connection.closeSync();
      }
    });
  });

  test("releases each workspace preview before the next relation", async () => {
    await requireNativePrerequisites("duckdb");
    await withTempFixtureDir("query-workspace-reader", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const writer = await createDuckDbConnection();
      try {
        await writer.run(`attach ${escapeSqlStringLiteral(inputPath)} as fixture`);
        await writer.run(
          "insert into fixture.main.users select range + 4, 'member', 'active' from range(10000)",
        );
        await writer.run("checkpoint");
        await writer.run("detach fixture");
      } finally {
        writer.closeSync();
      }
      const connection = await createDuckDbConnection();
      try {
        const result = await collectDataQueryWorkspaceIntrospection(
          connection,
          inputPath,
          "duckdb",
          [
            { alias: "people", source: "users" },
            { alias: "time", source: "time_entries" },
          ],
          2,
        );
        expect(result.relations.map(({ alias, truncated }) => ({ alias, truncated }))).toEqual([
          { alias: "people", truncated: true },
          { alias: "time", truncated: true },
        ]);
        expect(result.relations[0]?.columns).toEqual([
          { name: "id", type: "INTEGER" },
          { name: "name", type: "VARCHAR" },
          { name: "status", type: "VARCHAR" },
        ]);
        expect(result.relations[1]?.sampleRows).toEqual([
          { entry_id: "1", team: "Core", hours: "8" },
          { entry_id: "2", team: "Infra", hours: "5" },
        ]);
        expect(
          (await executeDataQueryForAllRows(connection, "select count(*) as count from people"))
            .rows,
        ).toEqual([{ count: "10003" }]);
      } finally {
        connection.closeSync();
      }
    });
  });

  test.each(["single-source", "workspace"] as const)(
    "captures VARIANT schema and values before closing %s previews",
    async (mode) => {
      await requireNativePrerequisites("duckdb");
      await withTempFixtureDir("query-variant-reader", async (fixtureDir) => {
        const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
        const writer = await createDuckDbConnection();
        try {
          await writer.run(`attach ${escapeSqlStringLiteral(inputPath)} as fixture`);
          await writer.run(
            "create table fixture.main.variants as select range as id, 3::VARIANT as value, [3::VARIANT] as nested from range(10000)",
          );
          await writer.run("checkpoint");
          await writer.run("detach fixture");
        } finally {
          writer.closeSync();
        }

        const connection = await createDuckDbConnection();
        try {
          const result =
            mode === "single-source"
              ? await collectDataQuerySourceIntrospection(
                  connection,
                  inputPath,
                  "duckdb",
                  { source: "variants" },
                  2,
                )
              : await collectDataQueryWorkspaceIntrospection(
                  connection,
                  inputPath,
                  "duckdb",
                  [
                    { alias: "variants", source: "variants" },
                    { alias: "time", source: "time_entries" },
                  ],
                  2,
                );
          const preview = result.kind === "workspace" ? result.relations[0]! : result;
          expect(preview.columns).toEqual([
            { name: "id", type: "BIGINT" },
            { name: "value", type: "VARIANT" },
            { name: "nested", type: "VARIANT[]" },
          ]);
          expect(preview.sampleRows).toEqual([
            { id: "0", value: "3", nested: "[3]" },
            { id: "1", value: "3", nested: "[3]" },
          ]);
          expect(preview.truncated).toBe(true);
          if (result.kind === "workspace") {
            expect(result.relations[1]?.alias).toBe("time");
            expect(result.relations[1]?.sampleRows).toEqual([
              { entry_id: "1", team: "Core", hours: "8" },
              { entry_id: "2", team: "Infra", hours: "5" },
            ]);
          }
          const relation = mode === "single-source" ? "file" : "variants";
          expect(
            (
              await executeDataQueryForAllRows(
                connection,
                `select count(*) as count from ${relation}`,
              )
            ).rows,
          ).toEqual([{ count: "10000" }]);
        } finally {
          connection.closeSync();
        }
      });
    },
  );
});
