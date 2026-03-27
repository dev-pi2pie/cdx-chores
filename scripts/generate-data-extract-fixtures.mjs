import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = join(repoRoot, "examples", "playground", "data-extract");
const FIXTURE_TIMESTAMP = new Date("2026-03-18T00:00:00.000Z");

function printUsage() {
  console.log(
    [
      "Create deterministic data-extract fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-data-extract-fixtures.mjs seed [--output-dir <path>]",
      "  node scripts/generate-data-extract-fixtures.mjs clean [--output-dir <path>]",
      "  node scripts/generate-data-extract-fixtures.mjs reset [--output-dir <path>]",
      "",
      `Default output directory: ${defaultOutputDir}`,
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

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

function buildWorksheetXml(sheet) {
  const xmlRows = [];
  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
    const row = sheet.rows[rowIndex] ?? [];
    const rowNumber = rowIndex + 1;
    const cells = row
      .map((value, columnIndex) => {
        if (value === undefined || value === null || value === "") {
          return "";
        }
        const ref = `${toColumnName(columnIndex)}${rowNumber}`;
        if (typeof value === "number") {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
      })
      .filter((cellXml) => cellXml.length > 0)
      .join("");
    xmlRows.push(`<row r="${rowNumber}">${cells}</row>`);
  }

  const mergeXml =
    Array.isArray(sheet.mergedRanges) && sheet.mergedRanges.length > 0
      ? `<mergeCells count="${sheet.mergedRanges.length}">${sheet.mergedRanges
          .map((range) => `<mergeCell ref="${range}"/>`)
          .join("")}</mergeCells>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows.join("")}</sheetData>${mergeXml}</worksheet>`;
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
    files[`xl/worksheets/sheet${index + 1}.xml`] = buildWorksheetXml(sheet);
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

function createBasicRows() {
  return [
    { id: 1, name: "Ada", status: "active" },
    { id: 2, name: "Bob", status: "paused" },
    { id: 3, name: "Cyd", status: "draft" },
  ];
}

function createGenericRows() {
  return [
    { column_1: 1001, column_2: "active", column_3: "north" },
    { column_1: 1002, column_2: "paused", column_3: "south" },
  ];
}

function createNoHeadRows() {
  return [
    ["1", "Ada", "active", "2026-03-01"],
    ["2", "Bob", "paused", "2026-03-02"],
    ["3", "Cyd", "draft", "2026-03-03"],
  ];
}

async function writeDelimitedFixture(outputDir, fileName, rows, delimiter) {
  await writeFile(join(outputDir, fileName), stringifyDelimitedRows(rows, delimiter), "utf8");
}

async function writeRawDelimitedFixture(outputDir, fileName, rows, delimiter) {
  const lines = rows.map((row) => row.join(delimiter));
  await writeFile(join(outputDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

function writeSqliteFixture(outputDir) {
  const path = join(outputDir, "multi.sqlite");
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      drop view if exists active_users;
      drop table if exists users;
      drop table if exists work_items;
      create table users (id integer, name text, status text);
      create table work_items (item_id integer, owner text, state text);
      insert into users values (1, 'Ada', 'active'), (2, 'Bob', 'paused'), (3, 'Cyd', 'active');
      insert into work_items values (101, 'Ada', 'open'), (102, 'Bob', 'closed');
      create view active_users as select id, name from users where status = 'active';
    `);
  } finally {
    db.close();
  }
}

async function writeSimpleWorkbook(outputDir) {
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
      ],
    },
  ]);
  const zipBuffer = buildStoredZip(
    Object.entries(workbook).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(join(outputDir, "multi.xlsx"), zipBuffer);
}

async function writeMessyWorkbook(outputDir) {
  const workbook = buildXlsxFiles([
    {
      name: "Summary",
      mergedRanges: ["B2:E2", "B4:E4"],
      rows: [
        [],
        [undefined, "Quarterly Operations Report"],
        [],
        [undefined, "Prepared For Review"],
        [],
        [],
        [undefined, "ID", "item", "status", "description"],
        [undefined, 1001, "Starter", "active", "Initial package"],
        [undefined, 1002, "Expansion", "paused", "Requires follow-up"],
        [undefined, 1003, "Renewal", "active", "Ready to ship"],
        [undefined, 1004, "Archive", "draft", "Awaiting approval"],
      ],
    },
    {
      name: "RawDump",
      rows: [
        ["tag", "value"],
        ["region", "north"],
        ["team", "core"],
      ],
    },
  ]);
  const zipBuffer = buildStoredZip(
    Object.entries(workbook).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(join(outputDir, "messy.xlsx"), zipBuffer);
}

async function writeCollapsedMergedWorkbook(outputDir) {
  const workbook = buildXlsxFiles([
    {
      name: "Summary",
      mergedRanges: ["B2:D2"],
      rows: [
        [],
        [undefined, "Hello This Is The Merged"],
        [],
        [undefined, "ID"],
        [undefined, 78],
        [undefined, 21],
        [undefined, 96],
        [undefined, 83],
      ],
    },
  ]);
  const zipBuffer = buildStoredZip(
    Object.entries(workbook).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(join(outputDir, "collapsed-merged.xlsx"), zipBuffer);
}

async function writeHeaderBandWorkbook(outputDir) {
  const workbook = buildXlsxFiles([
    {
      name: "Summary",
      mergedRanges: ["B2:E2"],
      rows: [
        [],
        [undefined, "Quarterly Review Packet"],
        [],
        [undefined, "Prepared for Operations"],
        [],
        [],
        [undefined, "ID", "question", "status", "notes"],
        [],
        [],
        [undefined, 101, "Confirm tax residency", "open", "Email pending"],
        [undefined, 102, "Collect withholding certificate", "closed", "Received"],
        [undefined, 103, "Review dividend statement", "open", "Waiting on broker"],
      ],
    },
  ]);
  const zipBuffer = buildStoredZip(
    Object.entries(workbook).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(join(outputDir, "header-band.xlsx"), zipBuffer);
}

async function seedFixtures(outputDir) {
  await ensureOutputDir(outputDir);

  await writeDelimitedFixture(outputDir, "basic.csv", createBasicRows(), ",");
  await writeDelimitedFixture(outputDir, "basic.tsv", createBasicRows(), "\t");
  await writeCollapsedMergedWorkbook(outputDir);
  await writeDelimitedFixture(outputDir, "generic.csv", createGenericRows(), ",");
  await writeHeaderBandWorkbook(outputDir);
  await writeRawDelimitedFixture(outputDir, "no-head.csv", createNoHeadRows(), ",");
  writeSqliteFixture(outputDir);
  await writeSimpleWorkbook(outputDir);
  await writeMessyWorkbook(outputDir);
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
    console.log(`Reset ${parsed.outputDir} with deterministic data extract fixtures`);
    return;
  }

  await seedFixtures(parsed.outputDir);
  console.log(`Seeded deterministic data extract fixtures in ${parsed.outputDir}`);
}

await main();
