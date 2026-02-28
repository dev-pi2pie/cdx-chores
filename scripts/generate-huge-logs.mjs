import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputDir = join(repoRoot, "examples", "playground", "huge-logs");

const DEFAULT_FILE_COUNT = 1000;
const MIN_LINES_PER_FILE = 8;
const MAX_LINES_PER_FILE = 24;

const levels = ["INFO", "WARN", "ERROR", "DEBUG"];
const services = ["api", "auth", "worker", "queue", "billing", "storage", "search"];
const actions = [
  "processed request",
  "saved record",
  "loaded config",
  "scheduled retry",
  "completed sync",
  "validated payload",
  "opened connection",
  "closed session",
  "updated cache",
  "published event",
  "checked quota",
  "rotated token",
];
const subjects = [
  "for tenant blue-river",
  "for tenant north-hill",
  "for batch upload",
  "for report job",
  "for daily digest",
  "for payment flow",
  "for media import",
  "for search index",
  "for archive task",
  "for metrics flush",
];
const outcomes = [
  "with stable latency",
  "after a short retry",
  "within expected range",
  "after validation passed",
  "with a fallback path",
  "without user impact",
  "after cache refresh",
  "before timeout window",
  "with partial progress",
  "under light load",
];

function printUsage() {
  console.log(
    [
      "Create synthetic log fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-huge-logs.mjs seed [--count <n>]",
      "  node scripts/generate-huge-logs.mjs clean",
      "  node scripts/generate-huge-logs.mjs reset [--count <n>]",
      "",
      `Default count: ${DEFAULT_FILE_COUNT}`,
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

  let count = DEFAULT_FILE_COUNT;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--count" || arg === "-n") {
      const raw = rest[index + 1];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 0) {
        throw new Error("Expected a non-negative integer after --count");
      }
      count = Number(raw);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, count };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[randomInt(0, items.length - 1)];
}

function padNumber(value, width) {
  return String(value).padStart(width, "0");
}

function buildTimestamp(baseTimeMs, offsetMs) {
  return new Date(baseTimeMs + offsetMs).toISOString();
}

function buildLogLine(baseTimeMs, lineIndex) {
  const offsetMs = lineIndex * randomInt(750, 8000);
  const timestamp = buildTimestamp(baseTimeMs, offsetMs);
  const level = pick(levels);
  const service = pick(services);
  const message = `${pick(actions)} ${pick(subjects)} ${pick(outcomes)}.`;
  return `${timestamp} ${level} [${service}] ${message}`;
}

function buildLogFileContent(fileIndex) {
  const lineCount = randomInt(MIN_LINES_PER_FILE, MAX_LINES_PER_FILE);
  const baseTimeMs = Date.now() - randomInt(0, 14 * 24 * 60 * 60 * 1000);
  const lines = [];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    lines.push(buildLogLine(baseTimeMs, lineIndex));
  }

  lines.push(`${new Date(baseTimeMs).toISOString()} INFO [fixture] file marker for sample ${padNumber(fileIndex, 4)}.`);
  return `${lines.join("\n")}\n`;
}

async function ensureOutputDir() {
  await mkdir(outputDir, { recursive: true });
}

async function cleanOutputDir() {
  await rm(outputDir, { recursive: true, force: true });
}

async function seedLogs(count) {
  await ensureOutputDir();

  for (let index = 1; index <= count; index += 1) {
    const fileName = `app-${padNumber(index, 5)}.log`;
    const filePath = join(outputDir, fileName);
    const content = buildLogFileContent(index);
    await writeFile(filePath, content, "utf8");
  }
}

async function countExistingLogs() {
  try {
    const entries = await readdir(outputDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".log")).length;
  } catch {
    return 0;
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
    const existingCount = await countExistingLogs();
    await cleanOutputDir();
    console.log(`Cleaned ${existingCount} log file(s) from ${outputDir}`);
    return;
  }

  if (parsed.command === "reset") {
    await cleanOutputDir();
    await seedLogs(parsed.count);
    console.log(`Reset ${outputDir} with ${parsed.count} log file(s)`);
    return;
  }

  await seedLogs(parsed.count);
  console.log(`Seeded ${parsed.count} log file(s) in ${outputDir}`);
}

await main();
