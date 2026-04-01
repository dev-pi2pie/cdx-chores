import { copyFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = join(repoRoot, "examples", "playground", "data-query-duckdb");

function escapeSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function printUsage() {
  console.log(
    [
      "Create deterministic DuckDB-only data-query fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-data-query-duckdb-fixtures.mjs seed [--output-dir <path>]",
      "  node scripts/generate-data-query-duckdb-fixtures.mjs clean [--output-dir <path>]",
      "  node scripts/generate-data-query-duckdb-fixtures.mjs reset [--output-dir <path>]",
      "",
      `Default output directory: ${defaultOutputDir}`,
      "Generated files: multi.duckdb, multi.db",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", outputDir: defaultOutputDir };
  }

  if (!["seed", "clean", "reset"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let outputDir = defaultOutputDir;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--output-dir") {
      const raw = rest[index + 1];
      if (!raw) {
        throw new Error("Expected a path after --output-dir");
      }
      outputDir = resolve(repoRoot, raw);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, outputDir };
}

async function ensureOutputDir(outputDir) {
  await mkdir(outputDir, { recursive: true });
}

async function cleanOutputDir(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
}

async function seedFixtures(outputDir) {
  await ensureOutputDir(outputDir);

  const duckdbPath = join(outputDir, "multi.duckdb");
  const dbAliasPath = join(outputDir, "multi.db");
  await rm(duckdbPath, { force: true });
  await rm(dbAliasPath, { force: true });

  const duckdb = await import("@duckdb/node-api");
  const connection = await duckdb.DuckDBConnection.create();
  try {
    await connection.run(`attach ${escapeSqlString(duckdbPath)} as fixture`);
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

  await copyFile(duckdbPath, dbAliasPath);
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
    await cleanOutputDir(parsed.outputDir);
    console.log(`Cleaned ${parsed.outputDir}`);
    return;
  }

  if (parsed.command === "reset") {
    await cleanOutputDir(parsed.outputDir);
    await seedFixtures(parsed.outputDir);
    console.log(`Reset ${parsed.outputDir} with deterministic data query DuckDB fixtures`);
    return;
  }

  await seedFixtures(parsed.outputDir);
  console.log(`Seeded deterministic data query DuckDB fixtures in ${parsed.outputDir}`);
}

await main();
