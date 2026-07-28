import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const coverImagePath = join(
  repoRoot,
  "examples",
  "playground",
  "md-pdf",
  "assets",
  "tool-cover-sample.jpg",
);
const smokeRoot = join(repoRoot, "examples", "playground", "md-pdf", "smoke");
const testScratchRoot = join(repoRoot, "examples", "playground", ".tmp-tests");
const testScratchPrefix = "markdown-pdf-profile-font-preservation-";
const requiredCommands = ["bun", "pandoc", "weasyprint"];
const templateHeadingFamilyPlaceholder = "<operator-supplied-installed-family>";
const ownershipMarkerName = ".cdx-chores-profile-font-preservation-smoke";
const ownershipMarkerContent = "cdx-chores markdown-pdf profile-font-preservation smoke v1\n";

function printUsage() {
  console.log(
    [
      "Plan, run, or clean the Markdown PDF Profile font-preservation smoke.",
      "",
      "Usage:",
      "  bun scripts/generate-markdown-pdf-profile-font-preservation-smoke.mjs plan --input <path> --profile <path> --smoke-dir <path> [--template-heading-family <installed-family>]",
      "  bun scripts/generate-markdown-pdf-profile-font-preservation-smoke.mjs run --input <path> --profile <path> --smoke-dir <path> [--allow-codex-assisted --template-heading-family <installed-family>]",
      "  bun scripts/generate-markdown-pdf-profile-font-preservation-smoke.mjs clean --smoke-dir <path>",
      "",
      "The smoke directory must be a direct, harness-owned generated-output child.",
      "Input and Profile files must remain outside the generated-output directory.",
      "Codex-assisted scenarios require explicit opt-in.",
      "Interactive installed-font selection is a documented manual scenario in the plan.",
    ].join("\n"),
  );
}

function requiredValue(rest, index, flag) {
  const value = rest[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Expected a path after ${flag}`);
  }
  return value;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help" };
  }
  if (!["plan", "run", "clean"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let inputPath;
  let profilePath;
  let smokeDir;
  let allowCodexAssisted = false;
  let templateHeadingFamily;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--input") {
      if (command === "clean") {
        throw new Error(`Unknown argument: ${arg}`);
      }
      inputPath = resolve(repoRoot, requiredValue(rest, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--profile") {
      if (command === "clean") {
        throw new Error(`Unknown argument: ${arg}`);
      }
      profilePath = resolve(repoRoot, requiredValue(rest, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--smoke-dir") {
      smokeDir = resolve(repoRoot, requiredValue(rest, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--allow-codex-assisted") {
      if (command !== "run") {
        throw new Error(`Unknown argument: ${arg}`);
      }
      allowCodexAssisted = true;
      continue;
    }
    if (arg === "--template-heading-family") {
      if (command === "clean") {
        throw new Error(`Unknown argument: ${arg}`);
      }
      templateHeadingFamily = requiredValue(rest, index, arg).trim();
      if (/[\r\n]/u.test(templateHeadingFamily)) {
        throw new Error("--template-heading-family must be a single-line family name.");
      }
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { command: "help" };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!smokeDir) {
    throw new Error("--smoke-dir is required.");
  }
  if ((command === "plan" || command === "run") && !inputPath) {
    throw new Error("--input is required.");
  }
  if ((command === "plan" || command === "run") && !profilePath) {
    throw new Error("--profile is required.");
  }
  if (command === "run" && allowCodexAssisted && !templateHeadingFamily) {
    throw new Error(
      "--template-heading-family is required when --allow-codex-assisted is enabled.",
    );
  }
  if (command === "run" && !allowCodexAssisted && templateHeadingFamily) {
    throw new Error("--template-heading-family requires --allow-codex-assisted.");
  }
  return {
    allowCodexAssisted,
    command,
    inputPath,
    profilePath,
    smokeDir,
    templateHeadingFamily,
  };
}

function isDescendant(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function isAllowedTestScratch(candidate) {
  const relativePath = relative(testScratchRoot, candidate);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return false;
  }
  return relativePath.split(/[\\/]+/)[0]?.startsWith(testScratchPrefix) === true;
}

function assertSafeSmokeDir(smokeDir) {
  if (allowedMutationRoot(smokeDir)) {
    return;
  }
  throw new Error("Refusing to use a smoke directory outside allowed direct-output children.");
}

function allowedMutationRoot(smokeDir) {
  if (dirname(smokeDir) === smokeRoot) {
    return smokeRoot;
  }
  const relativePath = relative(testScratchRoot, smokeDir);
  const scratchName = relativePath.split(/[\\/]+/)[0];
  if (
    isAllowedTestScratch(smokeDir) &&
    scratchName &&
    dirname(smokeDir) === join(testScratchRoot, scratchName)
  ) {
    return join(testScratchRoot, scratchName);
  }
  return undefined;
}

async function assertNoSymlinkedMutationComponents(smokeDir) {
  const allowedRoot = allowedMutationRoot(smokeDir);
  const trustedRoot = allowedRoot === smokeRoot ? repoRoot : testScratchRoot;
  const relativePath = relative(trustedRoot, smokeDir);
  const paths = [trustedRoot];
  let current = trustedRoot;
  for (const segment of relativePath.split(/[\\/]+/).filter(Boolean)) {
    current = join(current, segment);
    paths.push(current);
  }

  for (const candidate of paths) {
    try {
      if ((await lstat(candidate)).isSymbolicLink()) {
        throw new Error("Refusing to use a smoke directory with a symbolic-link path component.");
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
}

async function assertSafeSmokeMutationTarget(smokeDir) {
  assertSafeSmokeDir(smokeDir);
  await assertNoSymlinkedMutationComponents(smokeDir);
}

async function detachAndRemoveOwnedSmokeDir(smokeDir) {
  await assertSafeSmokeMutationTarget(smokeDir);
  try {
    const smokeStat = await lstat(smokeDir);
    if (!smokeStat.isDirectory() || smokeStat.isSymbolicLink()) {
      throw new Error("Refusing to remove a smoke target that is not a real directory.");
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  try {
    if ((await readFile(join(smokeDir, ownershipMarkerName), "utf8")) !== ownershipMarkerContent) {
      throw new Error("Unexpected ownership marker content.");
    }
  } catch {
    throw new Error("Refusing to remove a smoke directory without its ownership marker.");
  }

  const detachedPath = join(dirname(smokeDir), `.${basename(smokeDir)}.cleanup-${randomUUID()}`);
  await rename(smokeDir, detachedPath);

  let owned = false;
  try {
    const detachedStat = await lstat(detachedPath);
    owned =
      detachedStat.isDirectory() &&
      !detachedStat.isSymbolicLink() &&
      (await readFile(join(detachedPath, ownershipMarkerName), "utf8")) === ownershipMarkerContent;
  } catch {
    owned = false;
  }
  if (!owned) {
    try {
      await rename(detachedPath, smokeDir);
    } catch (error) {
      throw new Error(
        `Refusing to remove a detached smoke directory whose ownership changed; restoration failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    throw new Error("Refusing to remove a smoke directory whose ownership changed.");
  }

  await rm(detachedPath, { recursive: true, force: true });
}

function assertResourceOutsideSmoke(resourcePath, smokeDir, label) {
  if (resourcePath === smokeDir || isDescendant(smokeDir, resourcePath)) {
    throw new Error(`Refusing to use ${label} located inside the smoke directory.`);
  }
}

async function assertCanonicalResourceOutsideSmoke(resourcePath, smokeDir, label) {
  try {
    const [canonicalResourcePath, canonicalSmokeDir] = await Promise.all([
      realpath(resourcePath),
      realpath(smokeDir),
    ]);
    assertResourceOutsideSmoke(canonicalResourcePath, canonicalSmokeDir, label);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function assertRegularFile(resourcePath, label) {
  try {
    const resourceStat = await stat(resourcePath);
    if (resourceStat.isFile()) {
      return;
    }
  } catch {
    // Report one stable validation category below.
  }
  throw new Error(`${label} must exist as a regular file.`);
}

function renderArgv({ bundle, css, html, input, noDefaultCss = false, output, profile, template }) {
  const argv = ["bun", "src/bin.ts", "md", "to-pdf", "--input", input];
  if (bundle) {
    argv.push("--bundle", bundle);
  }
  if (profile) {
    argv.push("--profile", profile);
  }
  if (template) {
    argv.push("--template", template);
  }
  if (css) {
    argv.push("--css", css);
  }
  if (noDefaultCss) {
    argv.push("--no-default-css");
  }
  argv.push("--html-output", html, "--output", output, "--overwrite");
  return argv;
}

function createPlan(
  inputPath,
  profilePath,
  smokeDir,
  templateHeadingFamily = templateHeadingFamilyPlaceholder,
) {
  const partialBundle = join(smokeDir, "partial-template");
  const projectBundle = join(smokeDir, "complete-project");
  const deliberateBundle = join(smokeDir, "template-level-override");
  const userCssPath = join(smokeDir, "user-override.css");
  const outputPath = (name, extension) => join(smokeDir, "outputs", `${name}.${extension}`);

  const commands = [
    {
      id: "profile-control-render",
      scenario: "profile-control",
      argv: renderArgv({
        input: inputPath,
        profile: profilePath,
        html: outputPath("profile-control", "html"),
        output: outputPath("profile-control", "pdf"),
      }),
    },
    {
      id: "partial-template-generate",
      scenario: "partial-template",
      argv: [
        "bun",
        "src/bin.ts",
        "md",
        "pdf-template",
        "codex",
        "--base-profile",
        profilePath,
        "--cover-image",
        coverImagePath,
        "--output",
        partialBundle,
        "--keep-codex-report",
        "--overwrite",
      ],
    },
    {
      id: "partial-template-render",
      scenario: "partial-template",
      argv: renderArgv({
        input: inputPath,
        profile: profilePath,
        template: join(partialBundle, "template.html"),
        css: join(partialBundle, "style.css"),
        html: outputPath("partial-template", "html"),
        output: outputPath("partial-template", "pdf"),
      }),
    },
    {
      id: "complete-project-generate",
      scenario: "complete-project",
      argv: [
        "bun",
        "src/bin.ts",
        "md",
        "pdf-project",
        "codex",
        "--base-profile",
        profilePath,
        "--cover-image",
        coverImagePath,
        "--output",
        projectBundle,
        "--keep-codex-report",
        "--overwrite",
      ],
    },
    {
      id: "complete-project-render",
      scenario: "complete-project",
      argv: renderArgv({
        bundle: projectBundle,
        input: inputPath,
        html: outputPath("complete-project", "html"),
        output: outputPath("complete-project", "pdf"),
      }),
    },
    {
      id: "template-level-override-generate",
      scenario: "template-level-override",
      requiresCodexAssisted: true,
      argv: [
        "bun",
        "src/bin.ts",
        "md",
        "pdf-template",
        "codex",
        "--input",
        inputPath,
        "--base-profile",
        profilePath,
        "--cover-image",
        coverImagePath,
        "--intent",
        `Use ${templateHeadingFamily} as a deliberate Template-level heading font override and show the author byline on the cover.`,
        "--output",
        deliberateBundle,
        "--keep-codex-report",
        "--overwrite",
      ],
    },
    {
      id: "template-level-override-render",
      scenario: "template-level-override",
      requiresCodexAssisted: true,
      argv: renderArgv({
        input: inputPath,
        profile: profilePath,
        template: join(deliberateBundle, "template.html"),
        css: join(deliberateBundle, "style.css"),
        html: outputPath("template-level-override", "html"),
        output: outputPath("template-level-override", "pdf"),
      }),
    },
    {
      id: "no-default-css-render",
      scenario: "no-default-css",
      argv: renderArgv({
        profile: profilePath,
        bundle: partialBundle,
        input: inputPath,
        noDefaultCss: true,
        html: outputPath("no-default-css", "html"),
        output: outputPath("no-default-css", "pdf"),
      }),
    },
    {
      id: "user-css-render",
      scenario: "user-css",
      argv: renderArgv({
        input: inputPath,
        profile: profilePath,
        template: join(partialBundle, "template.html"),
        css: userCssPath,
        html: outputPath("user-css", "html"),
        output: outputPath("user-css", "pdf"),
      }),
    },
  ];

  return {
    schemaVersion: 1,
    input: inputPath,
    profile: profilePath,
    smokeDir,
    scenarios: [
      { id: "profile-control", mode: "automated", commandIds: ["profile-control-render"] },
      {
        id: "partial-template",
        mode: "automated",
        commandIds: ["partial-template-generate", "partial-template-render"],
      },
      {
        id: "complete-project",
        mode: "automated",
        commandIds: ["complete-project-generate", "complete-project-render"],
      },
      {
        id: "template-level-override",
        mode: "codex-assisted",
        commandIds: ["template-level-override-generate", "template-level-override-render"],
      },
      { id: "no-default-css", mode: "automated", commandIds: ["no-default-css-render"] },
      { id: "user-css", mode: "automated", commandIds: ["user-css-render"] },
      {
        id: "interactive",
        mode: "manual",
        commandIds: [],
        instructions:
          "Use Interactive to select an installed family, author a Template or Project, render it, and compare the labeled slots with the automated outputs.",
      },
    ],
    commands,
    inspection: {
      reports: [
        join(partialBundle, "template.codex-report.json"),
        join(projectBundle, "project.codex-report.json"),
        join(deliberateBundle, "template.codex-report.json"),
      ],
      generatedStylesheets: [
        join(partialBundle, "style.css"),
        join(projectBundle, "style.css"),
        join(deliberateBundle, "style.css"),
      ],
      templateLevelDecisionReport: join(deliberateBundle, "template.codex-report.json"),
    },
  };
}

function commandAvailable(command) {
  return (
    spawnSync(command, ["--version"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "ignore",
    }).status === 0
  );
}

function missingCommands() {
  return requiredCommands.filter((command) => !commandAvailable(command));
}

function runCommand(command) {
  const result = spawnSync(command.argv[0], command.argv.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`Smoke command failed: ${command.id} (exit ${result.status ?? "unknown"}).`);
  }
}

async function runSmoke(
  inputPath,
  profilePath,
  smokeDir,
  allowCodexAssisted,
  templateHeadingFamily,
) {
  await assertSafeSmokeMutationTarget(smokeDir);
  assertResourceOutsideSmoke(inputPath, smokeDir, "Markdown input");
  assertResourceOutsideSmoke(profilePath, smokeDir, "a Profile");
  await assertRegularFile(inputPath, "The Markdown input");
  await assertRegularFile(profilePath, "The operator Profile");
  await assertCanonicalResourceOutsideSmoke(inputPath, smokeDir, "Markdown input");
  await assertCanonicalResourceOutsideSmoke(profilePath, smokeDir, "a Profile");
  const unavailable = missingCommands();
  if (unavailable.length > 0) {
    console.error(
      JSON.stringify({
        category: "UNAVAILABLE",
        missingCommands: unavailable,
      }),
    );
    process.exitCode = 2;
    return;
  }

  const plan = createPlan(inputPath, profilePath, smokeDir, templateHeadingFamily);
  await detachAndRemoveOwnedSmokeDir(smokeDir);
  await mkdir(smokeDir);
  await writeFile(join(smokeDir, ownershipMarkerName), ownershipMarkerContent, "utf8");
  await mkdir(join(smokeDir, "outputs"));
  await writeFile(
    join(smokeDir, "user-override.css"),
    [
      "/* Deliberate user-author override for cascade inspection. */",
      '@import url("./partial-template/style.css");',
      "body { font-family: serif; }",
      "h1, h2, h3, h4, h5, h6 { font-family: sans-serif; }",
      "code, pre { font-family: monospace; }",
      "",
    ].join("\n"),
    "utf8",
  );

  const runnableCommands = plan.commands.filter(
    (command) => allowCodexAssisted || command.requiresCodexAssisted !== true,
  );
  for (const command of runnableCommands) {
    runCommand(command);
  }
  const runnableCommandIds = new Set(runnableCommands.map(({ id }) => id));
  const skippedScenarios = plan.scenarios
    .filter(
      ({ commandIds }) =>
        commandIds.length === 0 || commandIds.some((id) => !runnableCommandIds.has(id)),
    )
    .map(({ id }) => id);
  console.log(
    JSON.stringify({
      category: allowCodexAssisted ? "COMPLETE" : "COMPLETE_LOCAL",
      commandCount: runnableCommands.length,
      skippedScenarios,
    }),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    printUsage();
    return;
  }

  assertSafeSmokeDir(options.smokeDir);
  if (options.command === "clean") {
    await detachAndRemoveOwnedSmokeDir(options.smokeDir);
    console.log(JSON.stringify({ category: "CLEANED" }));
    return;
  }
  if (options.command === "plan") {
    assertResourceOutsideSmoke(options.inputPath, options.smokeDir, "Markdown input");
    assertResourceOutsideSmoke(options.profilePath, options.smokeDir, "a Profile");
    await assertCanonicalResourceOutsideSmoke(
      options.inputPath,
      options.smokeDir,
      "Markdown input",
    );
    await assertCanonicalResourceOutsideSmoke(options.profilePath, options.smokeDir, "a Profile");
    console.log(
      JSON.stringify(
        createPlan(
          options.inputPath,
          options.profilePath,
          options.smokeDir,
          options.templateHeadingFamily,
        ),
        null,
        2,
      ),
    );
    return;
  }
  await runSmoke(
    options.inputPath,
    options.profilePath,
    options.smokeDir,
    options.allowCodexAssisted,
    options.templateHeadingFamily,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
