// Run an already built, copied package. No installs, builds, model requests, or fixture writes.
// node scripts/duckdb-compatibility/built.mjs --package-root <copy> --fixture-root <copied fixtures>
//   --database <baseline-created copy> --extension-dir <isolated cache> --work-dir <empty directory>
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const { values } = parseArgs({
  options: Object.fromEntries(
    ["package-root", "fixture-root", "database", "extension-dir", "work-dir"].map((name) => [
      name,
      { type: "string" },
    ]),
  ),
});
for (const key of Object.keys(values)) values[key] = resolve(values[key]);
for (const key of ["package-root", "fixture-root", "database", "extension-dir", "work-dir"])
  assert(values[key], `Supply ${key}`);
const workDir = values["work-dir"];
await mkdir(workDir, { recursive: true });
assert.equal((await readdir(workDir)).length, 0, "work-dir must be empty");
const scratchHome = join(workDir, "home");
await cp(values["extension-dir"], join(scratchHome, ".duckdb/extensions"), { recursive: true });
const cli = join(values["package-root"], "dist/esm/bin.mjs");
const apiVersion = createRequire(join(values["package-root"], "package.json"))(
  "@duckdb/node-api/package.json",
).version;
const checks = [];
const databaseHash = createHash("sha256")
  .update(await readFile(values.database))
  .digest("hex");
function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: values["package-root"],
    env: { ...process.env, HOME: scratchHome, NO_COLOR: "1", FORCE_COLOR: "0" },
    encoding: "utf8",
    timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, expectedStatus, result.stderr);
  return result;
}
async function check(id, operation) {
  try {
    checks.push({ id, status: "pass", result: await operation() });
  } catch (error) {
    checks.push({ id, status: "fail", error: error.message });
  }
}
for (const source of [
  { format: "csv", file: "basic.csv" },
  { format: "tsv", file: "basic.tsv" },
  { format: "parquet", file: "basic.parquet" },
  { format: "sqlite", file: "multi.sqlite", source: "users" },
  { format: "excel", file: "multi.xlsx", source: "RawData" },
  { format: "duckdb", source: "records" },
]) {
  const input = source.file ? join(values["fixture-root"], source.file) : values.database;
  const sourceArgs = source.source ? ["--source", source.source] : [];
  await check(`query-${source.format}`, () => {
    const result = JSON.parse(
      run(["data", "query", input, ...sourceArgs, "--sql", "select * from file", "--json"]).stdout,
    );
    assert(Array.isArray(result));
    assert.equal(result.length, source.format === "duckdb" ? 1 : 3);
    if (source.format === "excel") assert.deepEqual(result[0], { team: "Core", hours: 8 });
    else assert.equal(result[0].name, "Ada");
    return { rows: result.length, first: result[0] };
  });
  await check(`extract-${source.format}`, async () => {
    const output = join(workDir, `extract-${source.format}.json`);
    run(["data", "extract", input, ...sourceArgs, "--output", output]);
    const result = JSON.parse(await readFile(output, "utf8"));
    assert(Array.isArray(result));
    assert.equal(result.length, source.format === "duckdb" ? 1 : 3);
    if (source.format === "excel") assert.deepEqual(result[0], { team: "Core", hours: 8 });
    else assert.equal(result[0].name, "Ada");
    return { rows: result.length, first: result[0] };
  });
}
for (const shape of [
  {
    file: "messy.xlsx",
    source: "Summary",
    range: "B2:E11",
    header: "7",
    rows: 4,
    firstKey: "ID",
    firstValue: "1001",
  },
  {
    file: "header-band.xlsx",
    source: "Summary",
    range: "B7:E12",
    header: "7",
    rows: 3,
    firstKey: "ID",
    firstValue: "101",
  },
  {
    file: "stacked-merged-band.xlsx",
    source: "Sheet1",
    range: "B7:BR20",
    header: "7",
    body: "10",
    rows: 11,
    firstKey: "id",
    firstValue: "1",
  },
])
  await check(`shaped-extract-${shape.file}`, async () => {
    const output = join(workDir, `extract-${shape.file}.json`);
    run([
      "data",
      "extract",
      join(values["fixture-root"], "extract", shape.file),
      "--source",
      shape.source,
      "--range",
      shape.range,
      "--header-row",
      shape.header,
      ...(shape.body ? ["--body-start-row", shape.body] : []),
      "--output",
      output,
    ]);
    const result = JSON.parse(await readFile(output, "utf8"));
    assert.equal(result.length, shape.rows);
    assert.equal(String(result[0][shape.firstKey]), shape.firstValue);
    return { rows: result.length, first: result[0] };
  });
await check("bounded-table-output", () => {
  const result = run([
    "data",
    "query",
    values.database,
    "--source",
    "users",
    "--sql",
    "select id, name from file order by id",
    "--rows",
    "2",
  ]);
  assert.match(result.stdout, /user-0/);
  assert.match(result.stdout, /user-1/);
  assert.doesNotMatch(result.stdout, /user-2/);
  return "bounded output";
});
await check("workspace-query", () => {
  const result = JSON.parse(
    run([
      "data",
      "query",
      values.database,
      "--relation",
      "people=users",
      "--relation",
      "events=events",
      "--sql",
      "select people.name, events.event_type from people join events on people.id = events.user_id",
      "--json",
    ]).stdout,
  );
  assert.deepEqual(result, [{ name: "user-1", event_type: "login" }]);
  return result;
});
await check("json-query-precision", () => {
  const result = JSON.parse(
    run([
      "data",
      "query",
      join(values["fixture-root"], "basic.csv"),
      "--sql",
      "select 9007199254740993::BIGINT as big, 123456789012345.125::DECIMAL(18,3) as dec, NULL::VARCHAR as missing",
      "--json",
    ]).stdout,
  );
  assert.deepEqual(result, [
    { big: "9007199254740993", dec: "123456789012345.125", missing: null },
  ]);
  return result;
});
await check("database-bytes-unchanged", async () => {
  assert.equal(
    createHash("sha256")
      .update(await readFile(values.database))
      .digest("hex"),
    databaseHash,
  );
  return "unchanged";
});
const report = {
  apiVersion,
  runtime: process.version,
  platform: `${process.platform}-${process.arch}`,
  passed: checks.filter((entry) => entry.status === "pass").length,
  failed: checks.filter((entry) => entry.status === "fail").length,
  checks,
};
await writeFile(join(workDir, "built-results.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.failed) process.exitCode = 1;
