import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = join(repoRoot, "examples", "playground", "data-extract");
const sourceWorkbook = join(
  repoRoot,
  "examples",
  "playground",
  "issue-data",
  "big_multi_merged_cells.xlsx",
);
const fixtureFileName = "stacked-merged-band.xlsx";

const sharedStrings = [
  "RAW_TITLE",
  "id",
  "question",
  "status",
  "notes",
  "Does the customer need a follow-up call after the outage review?",
  "- [ ] Yes; - [ ] No",
  "callback",
  "Is there any pending refund evidence that finance still needs to verify?",
  "refund",
  "Do we already have the replacement tracking number from the warehouse?",
  "tracking",
  "Did legal approve the latest waiver wording for the support response?",
  "waiver",
  "Should billing pause the renewal invoice until the dispute is closed?",
  "renewal",
  "Has the onboarding checklist been resent to the implementation contact?",
  "onboarding",
  "Do we need another maintenance window before the migration can resume?",
  "maintenance",
  "Is there a signed change request covering the expanded delivery scope?",
  "change",
  "Has procurement confirmed the revised purchase order for the hardware?",
  "procurement",
  "Do we still need security sign-off for the temporary access exception?",
  "security",
  "Should the account remain in watch status until the next leadership review?",
  "watch",
];

function printUsage() {
  console.log(
    [
      "Create the public-safe stacked merged-band workbook fixture.",
      "",
      "Usage:",
      "  node scripts/generate-stacked-merged-band-fixture.mjs seed [--output-dir <path>]",
      "  node scripts/generate-stacked-merged-band-fixture.mjs clean [--output-dir <path>]",
      "  node scripts/generate-stacked-merged-band-fixture.mjs reset [--output-dir <path>]",
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

function escapeXmlText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildSharedStringsXml() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="38" uniqueCount="${sharedStrings.length}">` +
    sharedStrings.map((value) => `<si><t>${escapeXmlText(value)}</t></si>`).join("") +
    `</sst>`
  );
}

async function ensureOutputDir(outputDir) {
  await mkdir(outputDir, { recursive: true });
}

async function cleanFixture(outputDir) {
  const outputPath = join(outputDir, fixtureFileName);
  if (!existsSync(outputPath)) {
    return;
  }
  await unlink(outputPath);
}

async function writeFixture(outputDir) {
  await ensureOutputDir(outputDir);

  const workspace = await mkdtemp(join(tmpdir(), "stacked-merged-band-"));
  const unpackDir = join(workspace, "unpacked");
  await mkdir(unpackDir, { recursive: true });

  try {
    execFileSync("unzip", ["-qq", sourceWorkbook, "-d", unpackDir]);
    await writeFile(join(unpackDir, "xl", "sharedStrings.xml"), buildSharedStringsXml(), "utf8");
    execFileSync("zip", ["-qr", join(outputDir, fixtureFileName), "."], { cwd: unpackDir });
  } finally {
    await rm(workspace, { recursive: true, force: true });
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
    await cleanFixture(parsed.outputDir);
    console.log(`Cleaned ${join(parsed.outputDir, fixtureFileName)}`);
    return;
  }

  if (parsed.command === "reset") {
    await cleanFixture(parsed.outputDir);
    await writeFixture(parsed.outputDir);
    console.log(
      `Reset ${join(parsed.outputDir, fixtureFileName)} with the public stacked merged-band fixture`,
    );
    return;
  }

  await writeFixture(parsed.outputDir);
  console.log(`Seeded ${join(parsed.outputDir, fixtureFileName)}`);
}

await main();
