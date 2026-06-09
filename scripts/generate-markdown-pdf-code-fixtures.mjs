import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultFixtureDir = join(repoRoot, "test", "fixtures", "docs", "markdown-pdf-code");
const defaultSmokeDir = join(repoRoot, "examples", "playground", "markdown-pdf-code");
const testScratchRoot = join(repoRoot, "examples", "playground", ".tmp-tests");
const generatedPathPrefix = "markdown-pdf-code-";

const PROFILE_FIXTURES = {
  default: {
    fileName: "profiles/code-highlight-default.yml",
    content: ["code:", "  highlight: true", ""].join("\n"),
  },
  altTheme: {
    fileName: "profiles/code-highlight-alt-theme.yml",
    content: ["code:", "  highlight: true", "  theme: light-plus", ""].join("\n"),
  },
  lineNumbers: {
    fileName: "profiles/code-line-numbers.yml",
    content: [
      "code:",
      "  highlight: true",
      "  theme: github-light",
      "  lineNumbers: true",
      "",
    ].join("\n"),
  },
  transformerNotation: {
    fileName: "profiles/code-transformer-notation.yml",
    content: [
      "code:",
      "  highlight: true",
      "  theme: github-light",
      "  transformerNotation: true",
      "",
    ].join("\n"),
  },
  transformerNotationLineNumbers: {
    fileName: "profiles/code-transformer-notation-line-numbers.yml",
    content: [
      "code:",
      "  highlight: true",
      "  theme: github-light",
      "  lineNumbers: true",
      "  transformerNotation: true",
      "",
    ].join("\n"),
  },
};

const FIXTURE_CASES = [
  {
    name: "code-basic",
    profile: "default",
    markdown: [
      "---",
      "title: Code Basic",
      "---",
      "",
      "## Basic JavaScript Highlighting",
      "",
      "```js",
      "const total = items.reduce((sum, item) => sum + item.price, 0);",
      "console.log(`total: ${total}`);",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-plain-and-unsupported",
    profile: "default",
    markdown: [
      "---",
      "title: Plain And Unsupported Code",
      "---",
      "",
      "## Plain And Unsupported Fences",
      "",
      "```",
      "This block intentionally has no language.",
      "```",
      "",
      "```not-real",
      "keyword value",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-wrapping",
    profile: "altTheme",
    markdown: [
      "---",
      "title: Code Wrapping",
      "---",
      "",
      "## Long Line Wrapping",
      "",
      "```ts",
      "export const longMessage =",
      '  "This line is intentionally long enough to exercise wrapping behavior in a printed PDF code block without relying on horizontal scrolling.";',
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-line-numbers",
    profile: "lineNumbers",
    markdown: [
      "---",
      "title: Code Line Numbers",
      "---",
      "",
      "## Numbered Python Block",
      "",
      "```python",
      "def greet(name):",
      '    return f"Hello, {name}"',
      "",
      'print(greet("Ada"))',
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-mixed-content",
    profile: "default",
    markdown: [
      "---",
      "title: Mixed Code Content",
      "---",
      "",
      "## Mixed Content Around Code",
      "",
      "Intro paragraph before code.",
      "",
      "```yaml",
      "code:",
      "  highlight: true",
      "  theme: github-light",
      "```",
      "",
      "| Name      | Value   |",
      "| --------- | ------- |",
      "| highlight | enabled |",
      "",
      "```bash",
      "bun test test/cli-actions-md-to-pdf-code-highlight.test.ts",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-transformer-highlight-line",
    profile: "transformerNotation",
    markdown: [
      "---",
      "title: Code Transformer Highlight Line",
      "---",
      "",
      "## Highlighted Line Example",
      "",
      "```ts",
      "const normal = true;",
      "const highlighted = true; // [!code highlight]",
      "const after = true;",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-transformer-diff",
    profile: "transformerNotation",
    markdown: [
      "---",
      "title: Code Transformer Diff",
      "---",
      "",
      "## Inserted And Deleted Lines",
      "",
      "```ts",
      "const before = false; // [!code --]",
      "const after = true; // [!code ++]",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-transformer-focus",
    profile: "transformerNotation",
    markdown: [
      "---",
      "title: Code Transformer Focus",
      "---",
      "",
      "## Focused Lines",
      "",
      "```ts",
      "const normal = true;",
      "const focused = true; // [!code focus]",
      "const alsoFocused = true; // [!code focus:2]",
      "const focusedByRange = true;",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-transformer-error-warning",
    profile: "transformerNotation",
    markdown: [
      "---",
      "title: Code Transformer Error Warning",
      "---",
      "",
      "## Error And Warning Lines",
      "",
      "```ts",
      "const valid = true;",
      "const failed = false; // [!code error]",
      "const maybe = true; // [!code warning]",
      "const errorRange = false; // [!code error:2]",
      "const stillError = false;",
      "const warningRange = true; // [!code warning:2]",
      "const stillWarning = true;",
      "```",
      "",
    ].join("\n"),
  },
  {
    name: "code-transformer-line-numbers-combined",
    profile: "transformerNotationLineNumbers",
    markdown: [
      "---",
      "title: Code Transformer Line Numbers Combined",
      "---",
      "",
      "## Transformer Lines With Numbers",
      "",
      "```ts",
      "const highlighted = true; // [!code highlight]",
      "const removed = false; // [!code --]",
      "const inserted = true; // [!code ++]",
      "const focused = true; // [!code focus]",
      "const failed = false; // [!code error]",
      "const maybe = true; // [!code warning]",
      "```",
      "",
    ].join("\n"),
  },
];

function printUsage() {
  console.log(
    [
      "Create Markdown PDF code-highlighting fixtures and manual smoke outputs.",
      "",
      "Usage:",
      "  node scripts/generate-markdown-pdf-code-fixtures.mjs seed [--fixture-dir <path>]",
      "  node scripts/generate-markdown-pdf-code-fixtures.mjs clean [--smoke-dir <path>]",
      "  node scripts/generate-markdown-pdf-code-fixtures.mjs reset [--fixture-dir <path>] [--smoke-dir <path>]",
      "  node scripts/generate-markdown-pdf-code-fixtures.mjs smoke [--fixture-dir <path>] [--smoke-dir <path>]",
      "",
      `Default fixture directory: ${defaultFixtureDir}`,
      `Default smoke directory: ${defaultSmokeDir}`,
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", fixtureDir: defaultFixtureDir, smokeDir: defaultSmokeDir };
  }

  if (!["seed", "clean", "reset", "smoke"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let fixtureDir = defaultFixtureDir;
  let smokeDir = defaultSmokeDir;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--fixture-dir") {
      const raw = rest[index + 1];
      if (!raw) {
        throw new Error("Expected a path after --fixture-dir");
      }
      fixtureDir = resolve(repoRoot, raw);
      index += 1;
      continue;
    }
    if (arg === "--smoke-dir") {
      const raw = rest[index + 1];
      if (!raw) {
        throw new Error("Expected a path after --smoke-dir");
      }
      smokeDir = resolve(repoRoot, raw);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, fixtureDir, smokeDir };
}

function hasCommand(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
}

function isGeneratedMarkdownPdfCodePath(path) {
  const relativePath = relative(testScratchRoot, path);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return false;
  }

  return relativePath.split(/[\\/]+/)[0]?.startsWith(generatedPathPrefix) === true;
}

function assertSafeFixtureDir(fixtureDir) {
  if (fixtureDir === defaultFixtureDir || isGeneratedMarkdownPdfCodePath(fixtureDir)) {
    return;
  }

  throw new Error(
    `Refusing to reset fixture directory outside generated fixture roots: ${fixtureDir}`,
  );
}

function assertSafeSmokeDir(smokeDir) {
  if (smokeDir === defaultSmokeDir || isGeneratedMarkdownPdfCodePath(smokeDir)) {
    return;
  }

  throw new Error(`Refusing to clean smoke directory outside generated smoke roots: ${smokeDir}`);
}

async function writeFixtureFiles(fixtureDir) {
  assertSafeFixtureDir(fixtureDir);
  await rm(fixtureDir, { recursive: true, force: true });
  await mkdir(fixtureDir, { recursive: true });
  await mkdir(join(fixtureDir, "profiles"), { recursive: true });

  for (const fixtureCase of FIXTURE_CASES) {
    await writeFile(join(fixtureDir, `${fixtureCase.name}.md`), fixtureCase.markdown, "utf8");
  }
  for (const profile of Object.values(PROFILE_FIXTURES)) {
    await writeFile(join(fixtureDir, profile.fileName), profile.content, "utf8");
  }
}

async function cleanSmoke(smokeDir) {
  assertSafeSmokeDir(smokeDir);
  await rm(smokeDir, { recursive: true, force: true });
}

async function resetFixturesAndSmoke(fixtureDir, smokeDir) {
  assertSafeSmokeDir(smokeDir);
  assertSafeFixtureDir(fixtureDir);
  await cleanSmoke(smokeDir);
  await writeFixtureFiles(fixtureDir);
}

function runSmokeCase(fixtureDir, smokeDir, smokeCase) {
  const inputPath = join(fixtureDir, `${smokeCase.name}.md`);
  const profilePath = join(fixtureDir, PROFILE_FIXTURES[smokeCase.profile].fileName);
  const htmlOutputPath = join(smokeDir, "html", `${smokeCase.name}.html`);
  const pdfOutputPath = join(smokeDir, "pdf", `${smokeCase.name}.pdf`);
  const result = spawnSync(
    "bun",
    [
      "src/bin.ts",
      "md",
      "to-pdf",
      "--input",
      inputPath,
      "--profile",
      profilePath,
      "--html-output",
      htmlOutputPath,
      "--output",
      pdfOutputPath,
      "--overwrite",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      [`Smoke render failed for ${smokeCase.name}.`, result.stdout.trim(), result.stderr.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

async function smoke(fixtureDir, smokeDir) {
  assertSafeSmokeDir(smokeDir);
  if (!hasCommand("pandoc") || !hasCommand("weasyprint")) {
    console.log("Skipping Markdown PDF code smoke: Pandoc or WeasyPrint is unavailable.");
    return;
  }

  await writeFixtureFiles(fixtureDir);
  await mkdir(join(smokeDir, "html"), { recursive: true });
  await mkdir(join(smokeDir, "pdf"), { recursive: true });
  for (const fixtureCase of FIXTURE_CASES) {
    runSmokeCase(fixtureDir, smokeDir, fixtureCase);
  }
  console.log(`Wrote Markdown PDF code smoke outputs: ${smokeDir}`);
}

async function main() {
  const { command, fixtureDir, smokeDir } = parseArgs(process.argv.slice(2));
  if (command === "help") {
    printUsage();
    return;
  }

  if (command === "clean") {
    await cleanSmoke(smokeDir);
    console.log(`Removed Markdown PDF code smoke outputs: ${smokeDir}`);
    return;
  }

  if (command === "seed") {
    await writeFixtureFiles(fixtureDir);
    console.log(`Wrote Markdown PDF code fixtures: ${fixtureDir}`);
    return;
  }

  if (command === "reset") {
    await resetFixturesAndSmoke(fixtureDir, smokeDir);
    console.log(`Reset Markdown PDF code fixtures: ${fixtureDir}`);
    return;
  }

  await smoke(fixtureDir, smokeDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
