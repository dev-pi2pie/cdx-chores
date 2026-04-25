import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = join(repoRoot, "examples", "playground", "stack-cases");
const scratchOutputRoot = join(repoRoot, "examples", "playground", ".tmp-tests");

function printUsage() {
  console.log(
    [
      "Create deterministic data-stack fixtures for manual smoke tests and future tests.",
      "",
      "Usage:",
      "  node scripts/generate-data-stack-fixtures.mjs seed [--output-dir <path>]",
      "  node scripts/generate-data-stack-fixtures.mjs clean --output-dir <path>",
      "  node scripts/generate-data-stack-fixtures.mjs reset [--output-dir <path>]",
      "",
      `Default output directory: ${defaultOutputDir}`,
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", outputDir: defaultOutputDir, outputDirProvided: false };
  }

  if (!["seed", "clean", "reset"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let outputDir = defaultOutputDir;
  let outputDirProvided = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--output-dir") {
      const raw = rest[index + 1];
      if (!raw) {
        throw new Error("Expected a path after --output-dir");
      }
      outputDir = resolve(repoRoot, raw);
      outputDirProvided = true;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, outputDir, outputDirProvided };
}

function escapeDelimitedCell(value, delimiter) {
  const text = String(value ?? "");
  if (
    !(text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiter))
  ) {
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

function rowsToHeaderlessDelimited(rows, delimiter) {
  const lines = rows.map((row) =>
    row.map((value) => escapeDelimitedCell(value ?? "", delimiter)).join(delimiter),
  );
  return `${lines.join("\n")}\n`;
}

function rowsToJsonl(rows) {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

async function writeFixture(outputDir, relativePath, content) {
  const absolutePath = join(outputDir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function cleanOutputDir(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
}

function isInsideDirectory(parentPath, candidatePath) {
  const relativePath = relative(parentPath, candidatePath);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function assertSafeResetTarget(outputDir) {
  const normalizedOutputDir = resolve(outputDir);
  if (
    normalizedOutputDir === defaultOutputDir ||
    isInsideDirectory(scratchOutputRoot, normalizedOutputDir)
  ) {
    return;
  }

  throw new Error(
    `Refusing to clean unsafe fixture output directory: ${outputDir}. Use the default stack fixture root or a path under ${scratchOutputRoot}.`,
  );
}

function assertSafeCleanTarget(outputDir) {
  const normalizedOutputDir = resolve(outputDir);
  if (normalizedOutputDir === defaultOutputDir) {
    throw new Error(
      "Refusing to clean the default tracked stack fixture tree. Use reset for the committed playground fixtures.",
    );
  }

  assertSafeResetTarget(normalizedOutputDir);
}

function createMatchingHeaderCases() {
  return [
    {
      path: "csv-matching-headers/part-001.csv",
      content: rowsToDelimited(
        [
          { id: 1001, name: "Ada", status: "active" },
          { id: 1002, name: "Bao", status: "paused" },
        ],
        ",",
      ),
    },
    {
      path: "csv-matching-headers/part-002.csv",
      content: rowsToDelimited(
        [
          { id: 1003, name: "Cora", status: "active" },
          { id: 1004, name: "Dion", status: "active" },
        ],
        ",",
      ),
    },
    {
      path: "csv-matching-headers/part-003.csv",
      content: rowsToDelimited(
        [
          { id: 1005, name: "Edda", status: "paused" },
          { id: 1006, name: "Finn", status: "active" },
        ],
        ",",
      ),
    },
  ];
}

function createTsvMatchingHeaderCases() {
  return [
    {
      path: "tsv-matching-headers/part-001.tsv",
      content: rowsToDelimited(
        [
          { id: 5001, name: "Mina", status: "active" },
          { id: 5002, name: "Nico", status: "paused" },
        ],
        "\t",
      ),
    },
    {
      path: "tsv-matching-headers/part-002.tsv",
      content: rowsToDelimited(
        [
          { id: 5003, name: "Orla", status: "active" },
          { id: 5004, name: "Pavel", status: "active" },
        ],
        "\t",
      ),
    },
  ];
}

function createHeaderlessCases() {
  return [
    {
      path: "csv-headerless/chunk-001.csv",
      content: rowsToHeaderlessDelimited(
        [
          [2001, "active", "north"],
          [2002, "paused", "south"],
        ],
        ",",
      ),
    },
    {
      path: "csv-headerless/chunk-002.csv",
      content: rowsToHeaderlessDelimited(
        [
          [2003, "active", "west"],
          [2004, "paused", "east"],
        ],
        ",",
      ),
    },
  ];
}

function createHeaderlessTsvCases() {
  return [
    {
      path: "tsv-headerless/chunk-001.tsv",
      content: rowsToHeaderlessDelimited(
        [
          [6001, "active", "north"],
          [6002, "paused", "south"],
        ],
        "\t",
      ),
    },
    {
      path: "tsv-headerless/chunk-002.tsv",
      content: rowsToHeaderlessDelimited(
        [
          [6003, "active", "west"],
          [6004, "paused", "east"],
        ],
        "\t",
      ),
    },
  ];
}

function createHeaderMismatchCases() {
  return [
    {
      path: "csv-header-mismatch/source-a.csv",
      content: rowsToDelimited(
        [
          { id: 3001, name: "Iris", status: "active" },
          { id: 3002, name: "Jules", status: "paused" },
        ],
        ",",
      ),
    },
    {
      path: "csv-header-mismatch/source-b.csv",
      content: rowsToDelimited(
        [
          { id: 3003, name: "Kira", state: "active" },
          { id: 3004, name: "Luca", state: "paused" },
        ],
        ",",
      ),
    },
  ];
}

function createJsonlCases() {
  return [
    {
      path: "jsonl-basic/day-01.jsonl",
      content: rowsToJsonl([
        { id: "evt-001", user_id: 41, action: "login", region: "apac" },
        { id: "evt-002", user_id: 42, action: "view", region: "emea" },
      ]),
    },
    {
      path: "jsonl-basic/day-02.jsonl",
      content: rowsToJsonl([
        { id: "evt-003", user_id: 43, action: "purchase", region: "amer" },
        { id: "evt-004", user_id: 44, action: "logout", region: "apac" },
      ]),
    },
  ];
}

function createJsonArrayCases() {
  return [
    {
      path: "json-array-basic/day-01.json",
      content: `${JSON.stringify([
        { id: "evt-001", status: "active" },
        { id: "evt-002", status: "paused" },
      ])}\n`,
    },
    {
      path: "json-array-basic/day-02.json",
      content: `${JSON.stringify([{ status: "active", id: "evt-003" }])}\n`,
    },
  ];
}

function createUnionCases() {
  return [
    {
      path: "csv-union/source-a.csv",
      content: rowsToDelimited([{ id: 1, name: "Ada", noise: "drop-a" }], ","),
    },
    {
      path: "csv-union/source-b.csv",
      content: rowsToDelimited([{ id: 2, status: "active", noise: "drop-b" }], ","),
    },
  ];
}

function createNoCodexSignalCases() {
  return [
    {
      path: "csv-no-codex-signal/part-001.csv",
      content: rowsToDelimited(
        [
          { a: 0, b: 0, c: 0 },
          { a: 0, b: 0, c: 1 },
          { a: 0, b: 1, c: 0 },
          { a: 0, b: 1, c: 1 },
        ],
        ",",
      ),
    },
    {
      path: "csv-no-codex-signal/part-002.csv",
      content: rowsToDelimited(
        [
          { a: 1, b: 0, c: 0 },
          { a: 1, b: 0, c: 1 },
          { a: 1, b: 1, c: 0 },
          { a: 1, b: 1, c: 1 },
        ],
        ",",
      ),
    },
  ];
}

function createRecursiveCases() {
  return [
    {
      path: "recursive-depth/top-level.csv",
      content: rowsToDelimited(
        [
          { id: 4001, bucket: "root", status: "active" },
          { id: 4002, bucket: "root", status: "paused" },
        ],
        ",",
      ),
    },
    {
      path: "recursive-depth/level-1/branch-a.csv",
      content: rowsToDelimited(
        [
          { id: 4003, bucket: "level-1", status: "active" },
          { id: 4004, bucket: "level-1", status: "paused" },
        ],
        ",",
      ),
    },
    {
      path: "recursive-depth/level-1/level-2/branch-b.csv",
      content: rowsToDelimited(
        [
          { id: 4005, bucket: "level-2", status: "active" },
          { id: 4006, bucket: "level-2", status: "paused" },
        ],
        ",",
      ),
    },
  ];
}

async function seedFixtures(outputDir) {
  await mkdir(outputDir, { recursive: true });

  const fixtures = [
    ...createMatchingHeaderCases(),
    ...createTsvMatchingHeaderCases(),
    ...createHeaderlessCases(),
    ...createHeaderlessTsvCases(),
    ...createHeaderMismatchCases(),
    ...createJsonlCases(),
    ...createJsonArrayCases(),
    ...createUnionCases(),
    ...createNoCodexSignalCases(),
    ...createRecursiveCases(),
  ];

  for (const fixture of fixtures) {
    await writeFixture(outputDir, fixture.path, fixture.content);
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

  try {
    if (parsed.command === "clean") {
      if (!parsed.outputDirProvided) {
        throw new Error(
          "Refusing to clean the default tracked stack fixture tree. Pass --output-dir to clean a non-default directory.",
        );
      }
      assertSafeCleanTarget(parsed.outputDir);
      await cleanOutputDir(parsed.outputDir);
      console.log(`Cleaned ${parsed.outputDir}`);
      return;
    }

    if (parsed.command === "reset") {
      assertSafeResetTarget(parsed.outputDir);
      await cleanOutputDir(parsed.outputDir);
      await seedFixtures(parsed.outputDir);
      console.log(`Reset ${parsed.outputDir} with deterministic data stack fixtures`);
      return;
    }

    await seedFixtures(parsed.outputDir);
    console.log(`Seeded deterministic data stack fixtures in ${parsed.outputDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export const fixtureGeneratorInternals = {
  assertSafeCleanTarget,
  assertSafeResetTarget,
  defaultOutputDir,
  scratchOutputRoot,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
