import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LARGE_ROW_COUNT,
  createBasicRows,
  createLargeRows,
  createWideRows,
} from "./tabular-preview-fixture-data.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputDir = join(repoRoot, "examples", "playground", "tabular-preview");

function printUsage() {
  console.log(
    [
      "Create deterministic tabular preview fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-tabular-preview-fixtures.mjs seed [--large-rows <n>]",
      "  node scripts/generate-tabular-preview-fixtures.mjs clean",
      "  node scripts/generate-tabular-preview-fixtures.mjs reset [--large-rows <n>]",
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

function escapeDelimitedCell(value, delimiter) {
  const text = String(value ?? "");
  if (!(text.includes('"') || text.includes("\n") || text.includes(delimiter))) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToDelimited(rows, delimiter) {
  if (rows.length === 0) {
    return "";
  }

  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      columns.push(key);
    }
  }

  const lines = [
    columns.map((column) => escapeDelimitedCell(column, delimiter)).join(delimiter),
    ...rows.map((row) =>
      columns.map((column) => escapeDelimitedCell(row[column] ?? "", delimiter)).join(delimiter),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function rowsToCsv(rows) {
  return rowsToDelimited(rows, ",");
}

function rowsToTsv(rows) {
  return rowsToDelimited(rows, "\t");
}

async function ensureOutputDir() {
  await mkdir(outputDir, { recursive: true });
}

async function cleanOutputDir() {
  await rm(outputDir, { recursive: true, force: true });
}

async function writeFixture(name, content) {
  await writeFile(join(outputDir, name), content, "utf8");
}

async function seedFixtures(largeRows) {
  await ensureOutputDir();

  const basicRows = createBasicRows();
  const wideRows = createWideRows();
  const largeData = createLargeRows(largeRows);

  await writeFixture("basic.json", `${JSON.stringify(basicRows, null, 2)}\n`);
  await writeFixture("basic.csv", rowsToCsv(basicRows));
  await writeFixture("basic.tsv", rowsToTsv(basicRows));
  await writeFixture("wide.json", `${JSON.stringify(wideRows, null, 2)}\n`);
  await writeFixture("wide.csv", rowsToCsv(wideRows));
  await writeFixture("wide.tsv", rowsToTsv(wideRows));
  await writeFixture(
    "scalar-array.json",
    `${JSON.stringify(["Ada", 36, true, { nested: "value" }], null, 2)}\n`,
  );
  await writeFixture("large.json", `${JSON.stringify(largeData, null, 2)}\n`);
  await writeFixture("large.csv", rowsToCsv(largeData));
  await writeFixture("large.tsv", rowsToTsv(largeData));
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
    console.log(`Reset ${outputDir} with deterministic tabular fixtures`);
    return;
  }

  await seedFixtures(parsed.largeRows);
  console.log(`Seeded deterministic tabular fixtures in ${outputDir}`);
}

await main();
