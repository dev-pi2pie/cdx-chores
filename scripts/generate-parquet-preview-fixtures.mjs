import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LARGE_ROW_COUNT,
  createBasicRows,
  createLargeRows,
  createWideRows,
} from "./tabular-preview-fixture-data.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputDir = join(repoRoot, "examples", "playground", "parquet-preview");

function escapeSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function printUsage() {
  console.log(
    [
      "Create deterministic Parquet preview fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-parquet-preview-fixtures.mjs seed [--large-rows <n>]",
      "  node scripts/generate-parquet-preview-fixtures.mjs clean",
      "  node scripts/generate-parquet-preview-fixtures.mjs reset [--large-rows <n>]",
      "",
      `Default large row count: ${DEFAULT_LARGE_ROW_COUNT}`,
      `Output directory: ${outputDir}`,
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help" };
  }

  if (!["seed", "clean", "reset"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let largeRows = DEFAULT_LARGE_ROW_COUNT;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--large-rows") {
      const raw = rest[index + 1];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error("Expected a positive integer after --large-rows");
      }
      largeRows = Number(raw);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, largeRows };
}

async function ensureOutputDir() {
  await mkdir(outputDir, { recursive: true });
}

async function cleanOutputDir() {
  await rm(outputDir, { recursive: true, force: true });
}

async function writeJsonFixture(tempDir, name, rows) {
  const path = join(tempDir, `${name}.json`);
  await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  return path;
}

async function writeParquetFixture(connection, jsonPath, parquetPath) {
  await connection.run(
    `copy (select * from read_json_auto(${escapeSqlString(jsonPath)})) to ${escapeSqlString(parquetPath)} (format parquet)`,
  );
}

async function seedFixtures(largeRows) {
  await ensureOutputDir();

  const duckdb = await import("@duckdb/node-api");
  const connection = await duckdb.DuckDBConnection.create();
  const tempDir = await mkdtemp(join(tmpdir(), "cdx-parquet-preview-"));
  try {
    const fixtures = [
      ["basic", createBasicRows()],
      ["wide", createWideRows()],
      ["large", createLargeRows(largeRows)],
    ];

    for (const [name, rows] of fixtures) {
      const jsonPath = await writeJsonFixture(tempDir, name, rows);
      await writeParquetFixture(connection, jsonPath, join(outputDir, `${name}.parquet`));
    }
  } finally {
    connection.closeSync();
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (parsed.command === "help") {
    printUsage();
    return;
  }

  if (parsed.command === "clean") {
    await cleanOutputDir();
    console.log(`Cleaned ${outputDir}`);
    return;
  }

  if (parsed.command === "reset") {
    await cleanOutputDir();
    await seedFixtures(parsed.largeRows);
    console.log(`Reset ${outputDir} with deterministic Parquet preview fixtures`);
    return;
  }

  await seedFixtures(parsed.largeRows);
  console.log(`Seeded deterministic Parquet preview fixtures in ${outputDir}`);
}

await main();
