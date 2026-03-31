import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_LARGE_ROW_COUNT,
  createBasicRows,
  createLargeRows,
} from "./tabular-preview-fixture-data.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = join(repoRoot, "examples", "playground", "data-query");
const FIXTURE_TIMESTAMP = new Date("2026-03-10T00:00:00.000Z");

function escapeSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function printUsage() {
  console.log(
    [
      "Create deterministic data-query fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-data-query-fixtures.mjs seed [--output-dir <path>] [--large-rows <n>]",
      "  node scripts/generate-data-query-fixtures.mjs clean [--output-dir <path>]",
      "  node scripts/generate-data-query-fixtures.mjs reset [--output-dir <path>] [--large-rows <n>]",
      "",
      `Default output directory: ${defaultOutputDir}`,
      `Default large row count: ${DEFAULT_LARGE_ROW_COUNT}`,
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", outputDir: defaultOutputDir, largeRows: DEFAULT_LARGE_ROW_COUNT };
  }

  if (!["seed", "clean", "reset"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let outputDir = defaultOutputDir;
  let largeRows = DEFAULT_LARGE_ROW_COUNT;
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

  return { command, outputDir, largeRows };
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stringifyDelimitedRows(rows, delimiter) {
  if (rows.length === 0) {
    return "";
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r") ||
      text.includes(delimiter)
    ) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const lines = [
    headers.map((header) => escapeCell(header)).join(delimiter),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(delimiter)),
  ];
  return `${lines.join("\n")}\n`;
}

function createGenericRows() {
  return [
    { column_1: 1001, column_2: "active", column_3: "north" },
    { column_1: 1002, column_2: "paused", column_3: "south" },
  ];
}

function toColumnName(index) {
  let current = index + 1;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function buildWorksheetXml(rows) {
  const [header, ...dataRows] = rows;
  const xmlRows = [
    `<row r="1">${header
      .map(
        (value, index) =>
          `<c r="${toColumnName(index)}1" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`,
      )
      .join("")}</row>`,
  ];

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 2;
    const row = dataRows[rowIndex];
    const cells = row
      .map((value, columnIndex) => {
        const ref = `${toColumnName(columnIndex)}${rowNumber}`;
        if (typeof value === "number") {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
      })
      .join("");
    xmlRows.push(`<row r="${rowNumber}">${cells}</row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows.join("")}</sheetData></worksheet>`;
}

function buildXlsxFiles(sheets) {
  const sheetEntries = sheets
    .map(
      ({ name }, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  const sheetRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");

  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
      .map(
        (_, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("")}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`,
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = buildWorksheetXml(sheet.rows);
  });

  return files;
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let round = 0; round < 8; round += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { date, time } = toDosDateTime(FIXTURE_TIMESTAMP);

  for (const [fileName, rawContent] of entries) {
    const fileNameBuffer = Buffer.from(fileName, "utf8");
    const contentBuffer = Buffer.isBuffer(rawContent)
      ? rawContent
      : Buffer.from(rawContent, "utf8");
    const checksum = crc32(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuffer, contentBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileNameBuffer);
    offset += localHeader.length + fileNameBuffer.length + contentBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

async function ensureOutputDir(outputDir) {
  await mkdir(outputDir, { recursive: true });
}

async function cleanOutputDir(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
}

async function writeDelimitedFixture(outputDir, fileName, rows, delimiter) {
  await writeFile(join(outputDir, fileName), stringifyDelimitedRows(rows, delimiter), "utf8");
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

function writeSqliteFixture(outputDir) {
  const path = join(outputDir, "multi.sqlite");
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      drop view if exists active_users;
      drop table if exists users;
      drop table if exists time_entries;
      create table users (id integer, name text, status text);
      create table time_entries (entry_id integer, team text, hours integer);
      insert into users values (1, 'Ada', 'active'), (2, 'Bob', 'paused'), (3, 'Cyd', 'active');
      insert into time_entries values (1, 'Core', 8), (2, 'Infra', 5), (3, 'Core', 3);
      create view active_users as select id, name from users where status = 'active';
    `);
  } finally {
    db.close();
  }
}

async function writeDuckDbFixture(outputDir) {
  const path = join(outputDir, "multi.duckdb");
  await rm(path, { force: true });

  const duckdb = await import("@duckdb/node-api");
  const connection = await duckdb.DuckDBConnection.create();
  try {
    await connection.run(`attach ${escapeSqlString(path)} as fixture`);
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
}

async function writeXlsxFixture(outputDir) {
  const workbook = buildXlsxFiles([
    {
      name: "Summary",
      rows: [
        ["id", "name", "status"],
        [1, "Ada", "active"],
        [2, "Bob", "paused"],
      ],
    },
    {
      name: "RawData",
      rows: [
        ["team", "hours"],
        ["Core", 8],
        ["Infra", 5],
        ["Core", 3],
      ],
    },
  ]);
  const zipBuffer = buildStoredZip(
    Object.entries(workbook).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(join(outputDir, "multi.xlsx"), zipBuffer);
}

async function seedFixtures(outputDir, largeRows) {
  await ensureOutputDir(outputDir);

  const basicRows = createBasicRows();
  const genericRows = createGenericRows();
  const largeFixtureRows = createLargeRows(largeRows);

  await writeDelimitedFixture(outputDir, "basic.csv", basicRows, ",");
  await writeDelimitedFixture(outputDir, "basic.tsv", basicRows, "\t");
  await writeDelimitedFixture(outputDir, "generic.csv", genericRows, ",");
  await writeDelimitedFixture(outputDir, "large.csv", largeFixtureRows, ",");

  const duckdb = await import("@duckdb/node-api");
  const connection = await duckdb.DuckDBConnection.create();
  const tempDir = await mkdtemp(join(tmpdir(), "cdx-data-query-fixtures-"));
  try {
    const basicJsonPath = await writeJsonFixture(tempDir, "basic", basicRows);
    const largeJsonPath = await writeJsonFixture(tempDir, "large", largeFixtureRows);
    await writeParquetFixture(connection, basicJsonPath, join(outputDir, "basic.parquet"));
    await writeParquetFixture(connection, largeJsonPath, join(outputDir, "large.parquet"));
  } finally {
    connection.closeSync();
    await rm(tempDir, { recursive: true, force: true });
  }

  writeSqliteFixture(outputDir);
  await writeDuckDbFixture(outputDir);
  await writeXlsxFixture(outputDir);
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
    await seedFixtures(parsed.outputDir, parsed.largeRows);
    console.log(`Reset ${parsed.outputDir} with deterministic data query fixtures`);
    return;
  }

  await seedFixtures(parsed.outputDir, parsed.largeRows);
  console.log(`Seeded deterministic data query fixtures in ${parsed.outputDir}`);
}

await main();
