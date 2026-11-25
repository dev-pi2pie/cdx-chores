// Run only reviewed dependencies. This tool never installs packages or extensions.
// node scripts/duckdb-compatibility/run.mjs --package-root <root> --generation baseline|candidate
//   --work-dir <empty scratch directory> [--read-db <copied database>] [--read-error]
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { sqlCases } from "./sql-cases.mjs";

const { values } = parseArgs({
  options: {
    "package-root": { type: "string" },
    generation: { type: "string" },
    "work-dir": { type: "string" },
    "read-db": { type: "string" },
    "read-error": { type: "boolean" },
  },
});
assert(
  values["package-root"] &&
    values["work-dir"] &&
    ["baseline", "candidate"].includes(values.generation),
  "Supply package-root, work-dir, and generation",
);
const generation = values.generation;
const workDir = resolve(values["work-dir"]);
await mkdir(workDir, { recursive: true });
assert.equal((await readdir(workDir)).length, 0, "work-dir must be empty");
const requirePackage = createRequire(join(resolve(values["package-root"]), "package.json"));
const apiVersion = requirePackage("@duckdb/node-api/package.json").version;
assert.equal(apiVersion, generation === "baseline" ? "1.5.6-r.2" : "2.0.0-r.1");
const { DuckDBConnection } = requirePackage("@duckdb/node-api");
const connection = await DuckDBConnection.create();
const checks = [];
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
async function rows(sql, parameters) {
  const reader = await connection.runAndReadAll(sql, parameters);
  return reader.getRowsJson();
}
async function check(id, operation) {
  try {
    const result = await operation();
    checks.push({ id, status: "pass", ...result });
  } catch (error) {
    checks.push({ id, status: "fail", error: error.message });
  }
}
try {
  const engine = (await rows("select version()"))[0][0];
  assert.equal(engine, generation === "baseline" ? "v1.5.6" : "v2.0.0");
  await connection.run("set autoinstall_known_extensions = false");
  for (const test of sqlCases) {
    await check(test.id, async () => {
      const expectedError = test[`${generation}Error`];
      if (expectedError) {
        await assert.rejects(rows(test.sql), expectedError);
        return { result: "expected error" };
      }
      const reader = await connection.runAndReadAll(test.sql);
      const actual = reader.getRowsJson();
      assert.deepEqual(actual, test.both ?? test[generation]);
      if (test.types) assert.deepEqual(reader.columnTypes().map(String), test.types);
      return { result: actual };
    });
  }
  await check("untyped-null-storage", async () => {
    await connection.run("create temp table null_probe as select NULL as value");
    const type = (await rows("describe null_probe"))[0][1];
    assert.equal(type, generation === "baseline" ? "INTEGER" : '"NULL"');
    if (generation === "candidate")
      await assert.rejects(
        connection.run("insert into null_probe values (1)"),
        /cast|convert|NULL/i,
      );
    else await connection.run("insert into null_probe values (1)");
    return { result: type };
  });
  await check("transaction-after-binder-error", async () => {
    await connection.run("begin");
    try {
      await assert.rejects(rows("select * from missing_compatibility_table"), /does not exist/i);
      if (generation === "candidate") await assert.rejects(rows("select 42"), /aborted/i);
      else assert.deepEqual(await rows("select 42"), [[42]]);
      return { result: generation === "baseline" ? "continues" : "requires rollback" };
    } finally {
      await connection.run("rollback");
      assert.deepEqual(await rows("select 42"), [[42]]);
    }
  });
  await check("typed-null-insert", async () => {
    await connection.run("create temp table typed_null_probe as select NULL::VARCHAR as value");
    await connection.run("insert into typed_null_probe values ('Ada')");
    assert.deepEqual(await rows("select value from typed_null_probe order by value nulls first"), [
      [null],
      ["Ada"],
    ]);
    return { result: "explicit NULL type accepts intended values" };
  });
  await check("identifier-boolean-aliases", async () => {
    await connection.run("set preserve_identifier_case = false");
    assert.deepEqual(await rows("select current_setting('preserve_identifier_case')"), [
      [generation === "baseline" ? false : "lowercase"],
    ]);
    await connection.run("set preserve_identifier_case = true");
    assert.deepEqual(await rows("select current_setting('preserve_identifier_case')"), [
      [generation === "baseline" ? true : "preserve_case"],
    ]);
    return { result: "legacy Boolean settings accepted" };
  });
  await check("bounded-stream-reuse", async () => {
    const reader = await connection.streamAndReadUntil("select i from range(100000) t(i)", 2);
    assert(reader.currentRowCount >= 2 && reader.currentRowCount < 100000);
    assert.equal(reader.done, false);
    assert.equal(reader.getRowsJson()[0][0], "0");
    if (generation === "candidate") {
      await assert.rejects(rows("select 42"), /open result/i);
      reader.closeSync();
      assert.equal(reader.getRowsJson()[0][0], "0");
    }
    assert.deepEqual(await rows("select 42"), [[42]]);
    return {
      result:
        generation === "baseline"
          ? "reuse succeeds"
          : "reuse requires reader.closeSync(), buffered rows retained",
    };
  });
  await check("variant-read-and-parameter-workaround", async () => {
    const reader = await connection.runAndReadAll(
      "select 3::VARIANT as value, [3::VARIANT] as nested",
    );
    assert.deepEqual(reader.columnTypes().map(String), ["VARIANT", "VARIANT[]"]);
    assert.deepEqual(reader.getRowsJson(), [[3, [3]]]);
    const prepared = await connection.runAndReadAll("select ?::VARIANT as value", [3]);
    assert.deepEqual(prepared.getRowsJson(), [[3]]);
    return { result: "VARIANT and nested values read through result API" };
  });
  await check("result-statement-type", async () => {
    const direct = await connection.runAndReadAll("select 1");
    const prepared = await connection.runAndReadAll("select ?::INTEGER", [1]);
    assert.equal(direct.result.statementType, 1);
    assert.equal(prepared.result.statementType, 1);
    return {
      result: { direct: direct.result.statementType, prepared: prepared.result.statementType },
    };
  });
  for (const storage of ["default", "v1.5.6"]) {
    await check(`create-${storage}-storage`, async () => {
      const database = join(workDir, `created-${storage}.duckdb`);
      await connection.run(
        `attach ${literal(database)} as generated${storage === "default" ? "" : " (storage_version 'v1.5.6')"}`,
      );
      await connection.run(
        "create table generated.main.records as select 1::INTEGER as id, 'Ada'::VARCHAR as name",
      );
      await connection.run(
        "create table generated.main.users as select i::INTEGER as id, 'user-' || i as name from range(100000) t(i)",
      );
      await connection.run(
        "create table generated.main.events as select 1::INTEGER as user_id, 'login'::VARCHAR as event_type",
      );
      await connection.run("checkpoint generated");
      await connection.run("detach generated");
      return { result: "created" };
    });
  }
  if (values["read-db"])
    await check("read-only-storage-interop", async () => {
      const database = resolve(values["read-db"]);
      const before = createHash("sha256")
        .update(await readFile(database))
        .digest("hex");
      if (values["read-error"]) {
        await assert.rejects(
          connection.run(`attach ${literal(database)} as original (read_only)`),
          /version|storage/i,
        );
        assert.equal(
          createHash("sha256")
            .update(await readFile(database))
            .digest("hex"),
          before,
        );
        return { result: "expected incompatible storage" };
      }
      await connection.run(`attach ${literal(database)} as original (read_only)`);
      assert.deepEqual(await rows("select * from original.main.records"), [[1, "Ada"]]);
      await assert.rejects(
        connection.run("insert into original.main.records values (2, 'Bob')"),
        /read.only/i,
      );
      await connection.run("detach original");
      assert.equal(
        createHash("sha256")
          .update(await readFile(database))
          .digest("hex"),
        before,
      );
      return { result: "readable, writes rejected, bytes unchanged" };
    });
  const report = {
    apiVersion,
    engine,
    generation,
    runtime: process.version,
    platform: `${process.platform}-${process.arch}`,
    passed: checks.filter((entry) => entry.status === "pass").length,
    failed: checks.filter((entry) => entry.status === "fail").length,
    checks,
  };
  await writeFile(join(workDir, "native-results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (report.failed) process.exitCode = 1;
} finally {
  connection.closeSync();
}
