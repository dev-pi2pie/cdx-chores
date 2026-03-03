import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputRoot = join(repoRoot, "examples", "playground", "cleanup-analyzer");

const DEFAULT_COUNT_PER_FAMILY = 8;
const UID_TOKENS = [
  "7k3m9q2x4t",
  "8n4r2w5z6v",
  "9p5s3x6y7w",
  "ah6t4y7z8x",
  "bj7u5z8x9y",
  "ck8v6x9y2z",
  "dm9w7y2z3x",
  "en2x8z3y4w",
  "fp3y9w4x5v",
  "gq4z2x5y6t",
  "hr5w3y6z7v",
  "js6x4z7w8t",
];

function printUsage() {
  console.log(
    [
      "Create synthetic cleanup-analyzer playground fixtures for manual smoke tests.",
      "",
      "Usage:",
      "  node scripts/generate-cleanup-analyzer-fixtures.mjs seed [--count-per-family <n>]",
      "  node scripts/generate-cleanup-analyzer-fixtures.mjs clean",
      "  node scripts/generate-cleanup-analyzer-fixtures.mjs reset [--count-per-family <n>]",
      "",
      `Default count per family: ${DEFAULT_COUNT_PER_FAMILY}`,
      `Output root: ${outputRoot}`,
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

  let countPerFamily = DEFAULT_COUNT_PER_FAMILY;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--count-per-family" || arg === "-n") {
      const raw = rest[index + 1];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) {
        throw new Error("Expected a positive integer after --count-per-family");
      }
      countPerFamily = Number(raw);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, countPerFamily };
}

function padNumber(value, width) {
  return String(value).padStart(width, "0");
}

function timestampFileName(index) {
  const day = 2 + Math.floor(index / 3);
  const hour = 4 + (index % 4);
  const minute = 53 + (index % 5);
  const second = 4 + index;
  const meridiem = index % 2 === 0 ? "PM" : "AM";
  const prefix = index % 3 === 0 ? "Screenshot" : index % 3 === 1 ? "Screen Recording" : "Capture";
  const extension = index % 3 === 1 ? ".mov" : index % 3 === 2 ? ".txt" : ".png";
  return `${prefix} 2026-03-${padNumber(day, 2)} at ${hour}.${padNumber(minute, 2)}.${padNumber(second, 2)} ${meridiem}${extension}`;
}

function dateFileName(index) {
  const day = 2 + index;
  const prefix = ["Meeting Notes", "Sprint Review", "Release Draft", "Field Report"][index % 4];
  const extension = index % 3 === 0 ? ".txt" : index % 3 === 1 ? ".md" : ".csv";
  return `${prefix} 2026-03-${padNumber(day, 2)}${extension}`;
}

function serialFileName(index) {
  if (index % 3 === 0) {
    return `app-${padNumber(index + 1, 5)}.log`;
  }
  if (index % 3 === 1) {
    return `scan_${padNumber(index + 2, 3)}.pdf`;
  }
  return `draft (${index + 2}).txt`;
}

function uidFileName(index) {
  const prefix = ["report", "capture", "meeting-notes", "handoff"][index % 4];
  const suffix = ["final", "archive", "review", "export"][index % 4];
  const extension = index % 2 === 0 ? ".txt" : ".md";
  return `${prefix} uid-${UID_TOKENS[index % UID_TOKENS.length]} ${suffix}${extension}`;
}

function mixedEntries(countPerFamily) {
  const entries = [];
  for (let index = 0; index < countPerFamily; index += 1) {
    const familyIndex = index % 5;
    const nestedPrefix = index >= Math.ceil(countPerFamily / 2) ? "nested/" : "";
    if (familyIndex === 0) {
      entries.push({
        relativePath: `${nestedPrefix}${timestampFileName(index)}`,
        content: `mixed timestamp sample ${index + 1}\n`,
      });
      continue;
    }
    if (familyIndex === 1) {
      entries.push({
        relativePath: `${nestedPrefix}${dateFileName(index)}`,
        content: `mixed date sample ${index + 1}\n`,
      });
      continue;
    }
    if (familyIndex === 2) {
      entries.push({
        relativePath: `${nestedPrefix}${serialFileName(index)}`,
        content: `mixed serial sample ${index + 1}\n`,
      });
      continue;
    }
    if (familyIndex === 3) {
      entries.push({
        relativePath: `${nestedPrefix}${uidFileName(index)}`,
        content: `mixed uid sample ${index + 1}\n`,
      });
      continue;
    }
    entries.push({
      relativePath: `${nestedPrefix}final copy ${padNumber(index + 1, 2)} 2026-03-${padNumber(2 + (index % 6), 2)}.txt`,
      content: `mixed ambiguous sample ${index + 1}\n`,
    });
  }
  return entries;
}

function familyEntries(countPerFamily) {
  return {
    "timestamp-family": Array.from({ length: countPerFamily }, (_, index) => ({
      relativePath: timestampFileName(index),
      content: `timestamp family sample ${index + 1}\n`,
    })),
    "date-family": Array.from({ length: countPerFamily }, (_, index) => ({
      relativePath: dateFileName(index),
      content: `date family sample ${index + 1}\n`,
    })),
    "serial-family": Array.from({ length: countPerFamily }, (_, index) => ({
      relativePath: serialFileName(index),
      content: `serial family sample ${index + 1}\n`,
    })),
    "uid-family": Array.from({ length: countPerFamily }, (_, index) => ({
      relativePath: uidFileName(index),
      content: `uid family sample ${index + 1}\n`,
    })),
    "mixed-family": mixedEntries(countPerFamily),
  };
}

async function ensureParentDirectory(path) {
  await mkdir(dirname(path), { recursive: true });
}

async function ensureOutputRoot() {
  await mkdir(outputRoot, { recursive: true });
}

async function cleanOutputRoot() {
  await rm(outputRoot, { recursive: true, force: true });
}

async function seedFixtures(countPerFamily) {
  await ensureOutputRoot();
  const families = familyEntries(countPerFamily);

  for (const [familyName, entries] of Object.entries(families)) {
    for (const entry of entries) {
      const filePath = join(outputRoot, familyName, entry.relativePath);
      await ensureParentDirectory(filePath);
      await writeFile(filePath, entry.content, "utf8");
    }
  }
}

async function countExistingFiles(directoryPath) {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        total += await countExistingFiles(entryPath);
        continue;
      }
      if (entry.isFile()) {
        total += 1;
      }
    }
    return total;
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
    const existingCount = await countExistingFiles(outputRoot);
    await cleanOutputRoot();
    console.log(`Cleaned ${existingCount} fixture file(s) from ${outputRoot}`);
    return;
  }

  if (parsed.command === "reset") {
    await cleanOutputRoot();
    await seedFixtures(parsed.countPerFamily);
    console.log(`Reset ${outputRoot} with ${parsed.countPerFamily} fixture file(s) per family`);
    return;
  }

  await seedFixtures(parsed.countPerFamily);
  console.log(`Seeded ${outputRoot} with ${parsed.countPerFamily} fixture file(s) per family`);
}

await main();
