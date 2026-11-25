// Bun runs source-product probes against a copied package with the reviewed dependency.
// bun scripts/duckdb-compatibility/product.mjs --package-root <copy> --generation baseline|candidate
//   --fixture-root <copied fixtures> --database <baseline-created copy> --extension-dir <isolated cache>
//   --work-dir <empty scratch directory> [--expect-reader-cleanup for an adapted copy]
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

const { values } = parseArgs({
  options: {
    ...Object.fromEntries(
      ["package-root", "generation", "fixture-root", "database", "extension-dir", "work-dir"].map(
        (name) => [name, { type: "string" }],
      ),
    ),
    "expect-reader-cleanup": { type: "boolean" },
  },
});
for (const key of ["package-root", "fixture-root", "database", "extension-dir", "work-dir"])
  assert(values[key], `Supply ${key}`);
assert(["baseline", "candidate"].includes(values.generation));
const packageRoot = resolve(values["package-root"]);
const requirePackage = createRequire(join(packageRoot, "package.json"));
const apiVersion = requirePackage("@duckdb/node-api/package.json").version;
assert.equal(apiVersion, values.generation === "baseline" ? "1.5.6-r.2" : "2.0.0-r.1");
const fixtures = resolve(values["fixture-root"]);
const database = resolve(values.database);
const workDir = resolve(values["work-dir"]);
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
await mkdir(workDir, { recursive: true });
assert.equal((await readdir(workDir)).length, 0, "work-dir must be empty");
const query = await import(pathToFileURL(join(packageRoot, "src/cli/duckdb/query/index.ts")).href);
const { loadParquetPreviewWindow } = await import(
  pathToFileURL(join(packageRoot, "src/cli/duckdb/parquet-preview.ts")).href
);
const checks = [];
async function withConnection(operation) {
  const connection = await query.createDuckDbConnection();
  try {
    await connection.run("set autoinstall_known_extensions = false");
    await connection.run(`set extension_directory = ${literal(resolve(values["extension-dir"]))}`);
    return await operation(connection);
  } finally {
    connection.closeSync();
  }
}
async function check(id, operation) {
  try {
    checks.push({ id, status: "pass", result: await operation() });
  } catch (error) {
    checks.push({ id, status: "fail", error: error.message });
  }
}
const before = createHash("sha256")
  .update(await readFile(database))
  .digest("hex");
for (const source of [
  { format: "csv", file: "basic.csv" },
  { format: "tsv", file: "basic.tsv" },
  { format: "parquet", file: "basic.parquet" },
  { format: "sqlite", file: "multi.sqlite", source: "users" },
  { format: "excel", file: "multi.xlsx", source: "RawData" },
  { format: "duckdb", source: "records" },
])
  await check(`prepare-query-${source.format}`, () =>
    withConnection(async (connection) => {
      const inputPath = source.file ? join(fixtures, source.file) : database;
      await query.prepareDataQuerySource(connection, inputPath, source.format, {
        source: source.source,
      });
      const result = await query.executeDataQueryForAllRows(connection, "select * from file");
      assert.equal(result.rows.length, source.format === "duckdb" ? 1 : 3);
      if (source.format === "excel") {
        assert.deepEqual(result.columns, ["team", "hours"]);
        assert.deepEqual(result.rows[0], { team: "Core", hours: 8 });
        assert.deepEqual(
          result.rows.map((row) => row.team),
          ["Core", "Infra", "Core"],
        );
      } else {
        assert(result.columns.includes("id"));
        assert.equal(String(result.rows[0].id), "1");
        assert.equal(result.rows[0].name, "Ada");
        assert.deepEqual(
          result.rows.map((row) => row.name),
          source.format === "duckdb" ? ["Ada"] : ["Ada", "Bob", "Cyd"],
        );
      }
      return { columns: result.columns, rows: result.rows.length, first: result.rows[0] };
    }),
  );
await check("no-header-and-header-mapping", () =>
  withConnection(async (connection) => {
    await query.prepareDataQuerySource(connection, join(fixtures, "extract/no-head.csv"), "csv", {
      noHeader: true,
      headerMappings: [{ from: "column_1", to: "id" }],
    });
    const result = await query.executeDataQueryForAllRows(connection, "select * from file");
    assert.equal(result.columns[0], "id");
    assert.equal(String(result.rows[0].id), "1");
    return result.columns;
  }),
);
for (const count of [0, 2, 3, 100000])
  await check(`bounded-table-${count}`, () =>
    withConnection(async (connection) => {
      const result = await query.executeDataQueryForTable(
        connection,
        `select i::INTEGER as id, NULL::VARCHAR as name from range(${count}) t(i)`,
        2,
      );
      assert.deepEqual(result.columns, ["id", "name"]);
      assert.equal(result.rows.length, Math.min(count, 2));
      assert.equal(result.truncated, count > 2);
      if (count) assert.deepEqual(result.rows[0], { values: { id: "0", name: "" } });
      return result;
    }),
  );
await check("table-followed-by-query", () =>
  withConnection(async (connection) => {
    await query.executeDataQueryForTable(connection, "select i from range(100000) t(i)", 2);
    const next = query.executeDataQueryForAllRows(connection, "select 42 as answer");
    if (values.generation === "candidate" && !values["expect-reader-cleanup"]) {
      await assert.rejects(next, /open result/i);
      return "required: close bounded reader before reuse";
    }
    assert.deepEqual((await next).rows, [{ answer: 42 }]);
    return "compatible";
  }),
);
await check("workspace-introspection-after-partial-stream", () =>
  withConnection(async (connection) => {
    const inspection = query.collectDataQueryWorkspaceIntrospection(
      connection,
      database,
      "duckdb",
      [
        { alias: "people", source: "users" },
        { alias: "events", source: "events" },
      ],
      2,
    );
    if (values.generation === "candidate" && !values["expect-reader-cleanup"]) {
      await assert.rejects(inspection, /open result/i);
      return "required: close each introspection reader before next relation";
    }
    const result = await inspection;
    assert.equal(result.relations.length, 2);
    assert.equal(result.relations[0].truncated, true);
    assert.equal(result.relations[0].sampleRows.length, 2);
    assert.equal(result.relations[1].sampleRows[0].event_type, "login");
    assert.equal(
      (await query.executeDataQueryForAllRows(connection, "select count(*) as n from people"))
        .rows[0].n,
      "100000",
    );
    return "compatible";
  }),
);
await check("single-source-introspection", () =>
  withConnection(async (connection) => {
    const result = await query.collectDataQuerySourceIntrospection(
      connection,
      join(fixtures, "basic.csv"),
      "csv",
      {},
      2,
    );
    assert.equal(result.truncated, true);
    assert.equal(result.sampleRows[0].name, "Ada");
    assert(result.columns.some((column) => column.name === "id" && column.type === "BIGINT"));
    return result.columns;
  }),
);
await check("single-introspection-followed-by-query", () =>
  withConnection(async (connection) => {
    const result = await query.collectDataQuerySourceIntrospection(
      connection,
      database,
      "duckdb",
      { source: "users" },
      2,
    );
    assert.equal(result.truncated, true);
    const next = query.executeDataQueryForAllRows(connection, "select 42 as answer");
    if (values.generation === "candidate" && !values["expect-reader-cleanup"]) {
      await assert.rejects(next, /open result/i);
      return "required: close single-source introspection reader before reuse";
    }
    assert.deepEqual((await next).rows, [{ answer: 42 }]);
    return "compatible";
  }),
);
await check("parameterized-parquet-preview", async () => {
  const result = await loadParquetPreviewWindow({
    inputPath: join(fixtures, "basic.parquet"),
    offset: 1,
    rowCount: 1,
    columns: ["id", "name"],
  });
  assert.equal(result.totalRows, 3);
  assert.deepEqual(result.rows, [{ values: { id: "2", name: "Bob" } }]);
  return result;
});
await check("result-types-and-precision", () =>
  withConnection(async (connection) => {
    const result = await query.executeDataQueryForAllRows(
      connection,
      "select 9007199254740993::BIGINT as big, 123456789012345.125::DECIMAL(18,3) as dec, timestamp '2026-03-01 12:34:56.123456' as stamp, NULL::VARCHAR as missing, [1,NULL] as nested",
    );
    assert.deepEqual(result.rows, [
      {
        big: "9007199254740993",
        dec: "123456789012345.125",
        stamp: "2026-03-01 12:34:56.123456",
        missing: null,
        nested: [1, null],
      },
    ]);
    return result.rows;
  }),
);
await check("variant-logical-type-and-prepared-workaround", () =>
  withConnection(async (connection) => {
    const { VARIANT } = requirePackage("@duckdb/node-api");
    if (values.generation === "candidate")
      assert.throws(() => VARIANT.toLogicalType(), /Cannot create a VARIANT logical type/);
    else assert.doesNotThrow(() => VARIANT.toLogicalType());
    await connection.run("create temp table variant_values(value VARIANT)");
    await connection.run("insert into variant_values values (?)", [3]);
    const result = await query.executeDataQueryForAllRows(
      connection,
      "select value, [value] as nested from variant_values",
    );
    assert.deepEqual(result.rows, [{ value: 3, nested: [3] }]);
    return values.generation === "candidate"
      ? "limitation: logical creation rejected, prepared binding and scalar/nested reading work"
      : "compatible";
  }),
);
await check("query-error-and-recovery", () =>
  withConnection(async (connection) => {
    await assert.rejects(
      query.executeDataQueryForAllRows(connection, "select * from absent_compatibility_relation"),
      (error) => error.code === "DATA_QUERY_FAILED",
    );
    assert.deepEqual(
      (await query.executeDataQueryForAllRows(connection, "select 42 as answer")).rows,
      [{ answer: 42 }],
    );
    return "error contract preserved and connection reusable";
  }),
);
await check("product-read-only-attachment", () =>
  withConnection(async (connection) => {
    await query.prepareDataQuerySource(connection, database, "duckdb", { source: "records" });
    await assert.rejects(
      connection.run("insert into __cdx_input_db.main.records values (2, 'Bob')"),
      /read.only/i,
    );
    assert.deepEqual(
      (await query.executeDataQueryForAllRows(connection, "select * from file")).rows,
      [{ id: 1, name: "Ada" }],
    );
    return "writes rejected";
  }),
);
await check("database-bytes-unchanged", async () => {
  assert.equal(
    createHash("sha256")
      .update(await readFile(database))
      .digest("hex"),
    before,
  );
  return "unchanged";
});
const report = {
  generation: values.generation,
  readerCleanupExpected: Boolean(values["expect-reader-cleanup"]),
  apiVersion,
  runtime: process.versions.bun ? `Bun ${process.versions.bun}` : process.version,
  platform: `${process.platform}-${process.arch}`,
  passed: checks.filter((entry) => entry.status === "pass").length,
  failed: checks.filter((entry) => entry.status === "fail").length,
  checks,
};
await writeFile(join(workDir, "product-results.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.failed) process.exitCode = 1;
