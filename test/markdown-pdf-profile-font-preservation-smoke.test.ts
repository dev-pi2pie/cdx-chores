import { describe, expect, test } from "bun:test";
import { chmod, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, withTempFixtureDir } from "./helpers/cli-test-utils";

const scriptPath = "scripts/generate-markdown-pdf-profile-font-preservation-smoke.mjs";
const ownershipMarkerName = ".cdx-chores-profile-font-preservation-smoke";
const ownershipMarkerContent = "cdx-chores markdown-pdf profile-font-preservation smoke v1\n";

function runHarness(
  args: string[],
  env?: NodeJS.ProcessEnv,
  execution: { cwd?: string; script?: string } = {},
) {
  const proc = Bun.spawnSync({
    cmd: [process.execPath, execution.script ?? scriptPath, ...args],
    cwd: execution.cwd ?? REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: env ? { ...process.env, ...env } : process.env,
  });
  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  };
}

async function writeSmokeCommandStubs(stubBinDir: string) {
  await mkdir(stubBinDir, { recursive: true });
  for (const command of ["bun", "pandoc", "weasyprint"]) {
    const stubPath = join(stubBinDir, command);
    await writeFile(
      stubPath,
      [
        "#!/bin/sh",
        'if [ "$1" != "--version" ]; then',
        `  printf '%s\\t%s\\n' '${command}' "$*" >> "$SMOKE_COMMAND_LOG"`,
        '  if [ -n "$SMOKE_FAIL_PATTERN" ]; then',
        '    case "$*" in',
        '      *"$SMOKE_FAIL_PATTERN"*) exit 7 ;;',
        "    esac",
        "  fi",
        "fi",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(stubPath, 0o755);
  }
}

async function readExecutedSmokeCommands(commandLogPath: string) {
  return (await readFile(commandLogPath, "utf8")).trim().split("\n");
}

async function withSmokeFixture(
  run: (input: { inputPath: string; profilePath: string; smokeDir: string }) => Promise<void>,
) {
  await withTempFixtureDir("markdown-pdf-profile-font-preservation-smoke", async (fixtureDir) => {
    const inputPath = join(fixtureDir, "input.md");
    const profilePath = join(fixtureDir, "operator-profile.yml");
    const smokeDir = join(fixtureDir, "smoke");
    await writeFile(inputPath, "# Smoke input\n\nBODY-EN: test\n", "utf8");
    await writeFile(profilePath, "fonts:\n  body:\n    default: Profile Body\n", "utf8");
    await run({ inputPath, profilePath, smokeDir });
  });
}

describe("Markdown PDF Profile font-preservation smoke harness", () => {
  test("prints help without naming a private output subdirectory", () => {
    const result = runHarness(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("plan --input <path> --profile <path> --smoke-dir <path>");
    expect(result.stdout).toContain("clean --smoke-dir <path>");
    expect(result.stdout).toContain(
      "Input and Profile files must remain outside the generated-output directory",
    );
    expect(result.stdout).toContain("--allow-codex-assisted");
    expect(result.stdout).toContain("--template-heading-family <installed-family>");
    expect(result.stdout).toContain("require explicit opt-in");
    expect(result.stdout).toContain("Interactive installed-font selection");
    expect(result.stdout).not.toContain("phase-4");
    expect(result.stdout).not.toContain("issue-60");
  });

  test("rejects unknown commands and arguments", () => {
    expect(runHarness(["unknown"]).stderr).toContain("Unknown command: unknown");
    expect(
      runHarness(["clean", "--smoke-dir", "unused", "--profile", "profile.yml"]).stderr,
    ).toContain("Unknown argument: --profile");
    expect(runHarness(["clean", "--smoke-dir", "unused", "--input", "input.md"]).stderr).toContain(
      "Unknown argument: --input",
    );
    expect(
      runHarness([
        "plan",
        "--input",
        "input.md",
        "--profile",
        "profile.yml",
        "--smoke-dir",
        "unused",
        "--allow-codex-assisted",
      ]).stderr,
    ).toContain("Unknown argument: --allow-codex-assisted");
    expect(runHarness(["plan", "--wat"]).stderr).toContain("Unknown argument: --wat");
  });

  test("requires explicit command inputs", () => {
    expect(
      runHarness(["plan", "--profile", "profile.yml", "--smoke-dir", "unused"]).stderr,
    ).toContain("--input is required");
    expect(runHarness(["plan", "--input", "input.md", "--smoke-dir", "unused"]).stderr).toContain(
      "--profile is required",
    );
    expect(runHarness(["run", "--input", "input.md", "--profile", "profile.yml"]).stderr).toContain(
      "--smoke-dir is required",
    );
    expect(runHarness(["clean"]).stderr).toContain("--smoke-dir is required");
    expect(runHarness(["plan", "--input"]).stderr).toContain("Expected a path after --input");
    expect(runHarness(["plan", "--profile"]).stderr).toContain("Expected a path after --profile");
    expect(
      runHarness([
        "run",
        "--input",
        "input.md",
        "--profile",
        "profile.yml",
        "--smoke-dir",
        "unused",
        "--allow-codex-assisted",
      ]).stderr,
    ).toContain("--template-heading-family is required");
    expect(
      runHarness([
        "run",
        "--input",
        "input.md",
        "--profile",
        "profile.yml",
        "--smoke-dir",
        "unused",
        "--template-heading-family",
        "Operator Heading",
      ]).stderr,
    ).toContain("--template-heading-family requires --allow-codex-assisted");
  });

  test("prints a deterministic plan with the complete scenario matrix", async () => {
    await withSmokeFixture(async ({ inputPath, profilePath, smokeDir }) => {
      const args = [
        "plan",
        "--input",
        inputPath,
        "--profile",
        profilePath,
        "--smoke-dir",
        smokeDir,
      ];
      const first = runHarness(args);
      const second = runHarness(args);

      expect(first.exitCode).toBe(0);
      expect(first.stderr).toBe("");
      expect(first.stdout).toBe(second.stdout);

      const plan = JSON.parse(first.stdout) as {
        commands: Array<{
          id: string;
          scenario: string;
          requiresCodexAssisted?: boolean;
          argv: string[];
        }>;
        scenarios: Array<{ id: string; mode: string; commandIds: string[] }>;
        input: string;
        inspection: { templateLevelDecisionReport: string };
      };
      expect(plan.input).toBe(inputPath);
      expect(plan.scenarios.map(({ id, mode }) => ({ id, mode }))).toEqual([
        { id: "profile-control", mode: "automated" },
        { id: "partial-template", mode: "automated" },
        { id: "complete-project", mode: "automated" },
        { id: "template-level-override", mode: "codex-assisted" },
        { id: "no-default-css", mode: "automated" },
        { id: "user-css", mode: "automated" },
        { id: "interactive", mode: "manual" },
      ]);
      expect(plan.scenarios.at(-1)?.commandIds).toEqual([]);
      expect(plan.commands.map((command) => command.id)).toEqual([
        "profile-control-render",
        "partial-template-generate",
        "partial-template-render",
        "complete-project-generate",
        "complete-project-render",
        "template-level-override-generate",
        "template-level-override-render",
        "no-default-css-render",
        "user-css-render",
      ]);

      for (const command of plan.commands) {
        expect(command.argv.slice(0, 2)).toEqual(["bun", "src/bin.ts"]);
      }
      expect(plan.commands.find(({ id }) => id === "partial-template-render")?.argv).toContain(
        "--profile",
      );
      const partialGenerate = plan.commands.find(
        ({ id }) => id === "partial-template-generate",
      )?.argv;
      expect(partialGenerate).toContain("--cover-image");
      expect(partialGenerate).not.toContain("--input");
      expect(partialGenerate).not.toContain("--intent");
      expect(plan.commands.find(({ id }) => id === "complete-project-render")?.argv).toContain(
        "--bundle",
      );
      const projectGenerate = plan.commands.find(
        ({ id }) => id === "complete-project-generate",
      )?.argv;
      expect(projectGenerate).toContain("--cover-image");
      expect(projectGenerate).not.toContain("--input");
      expect(projectGenerate).not.toContain("--intent");
      const templateLevelGenerate = plan.commands.find(
        ({ id }) => id === "template-level-override-generate",
      );
      expect(templateLevelGenerate?.argv).toContain("--cover-image");
      expect(templateLevelGenerate?.argv.join(" ")).toContain(
        "Template-level heading font override",
      );
      expect(templateLevelGenerate?.argv.join(" ")).toContain(
        "<operator-supplied-installed-family>",
      );
      expect(templateLevelGenerate?.argv.join(" ")).toContain("author byline");
      expect(templateLevelGenerate?.requiresCodexAssisted).toBe(true);
      expect(
        plan.commands.find(({ id }) => id === "template-level-override-render")
          ?.requiresCodexAssisted,
      ).toBe(true);
      expect(plan.commands.find(({ id }) => id === "no-default-css-render")?.argv).toContain(
        "--no-default-css",
      );
      expect(plan.commands.find(({ id }) => id === "user-css-render")?.argv).toContain("--css");
      expect(plan.commands.find(({ id }) => id === "user-css-render")?.argv).toContain(
        "--template",
      );
      expect(plan.inspection.templateLevelDecisionReport).toEndWith(
        "template-level-override/template.codex-report.json",
      );
    });
  });

  test("clean removes an allowed scratch directory", async () => {
    await withSmokeFixture(async ({ smokeDir }) => {
      const siblingPath = join(smokeDir, "..", "keep.txt");
      await mkdir(join(smokeDir, "outputs"), { recursive: true });
      await writeFile(join(smokeDir, "outputs", "remove.pdf"), "not a pdf", "utf8");
      await writeFile(join(smokeDir, ownershipMarkerName), ownershipMarkerContent, "utf8");
      await writeFile(siblingPath, "keep", "utf8");

      const result = runHarness(["clean", "--smoke-dir", smokeDir]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toEqual({ category: "CLEANED" });
      await expect(stat(smokeDir)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(siblingPath, "utf8")).toBe("keep");
    });
  });

  test("clean preserves a direct child without the exact ownership marker", async () => {
    await withSmokeFixture(async ({ smokeDir }) => {
      const keepPath = join(smokeDir, "keep.txt");
      await mkdir(smokeDir, { recursive: true });
      await writeFile(keepPath, "keep", "utf8");

      const result = runHarness(["clean", "--smoke-dir", smokeDir]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("without its ownership marker");
      expect(await readFile(keepPath, "utf8")).toBe("keep");

      await writeFile(join(smokeDir, ownershipMarkerName), "wrong owner\n", "utf8");
      const wrongMarkerResult = runHarness(["clean", "--smoke-dir", smokeDir]);

      expect(wrongMarkerResult.exitCode).toBe(1);
      expect(wrongMarkerResult.stderr).toContain("without its ownership marker");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("run executes eligible commands and derives skipped scenarios", async () => {
    await withSmokeFixture(async ({ inputPath, profilePath, smokeDir }) => {
      const stubBinDir = join(smokeDir, "..", "bin");
      const commandLogPath = join(smokeDir, "..", "commands.log");
      await writeSmokeCommandStubs(stubBinDir);

      const env = {
        PATH: stubBinDir,
        SMOKE_COMMAND_LOG: commandLogPath,
      };
      const planResult = runHarness([
        "plan",
        "--input",
        inputPath,
        "--profile",
        profilePath,
        "--smoke-dir",
        smokeDir,
        "--template-heading-family",
        "Operator Heading",
      ]);
      const plan = JSON.parse(planResult.stdout) as {
        commands: Array<{ argv: string[]; requiresCodexAssisted?: boolean }>;
      };
      const loggedCommand = ({ argv }: { argv: string[] }) =>
        `${argv[0]}\t${argv.slice(1).join(" ")}`;
      const localResult = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", smokeDir],
        env,
      );

      expect(localResult.exitCode).toBe(0);
      expect(localResult.stderr).toBe("");
      expect(JSON.parse(localResult.stdout)).toEqual({
        category: "COMPLETE_LOCAL",
        commandCount: 7,
        skippedScenarios: ["template-level-override", "interactive"],
      });
      const localCommands = await readExecutedSmokeCommands(commandLogPath);
      expect(localCommands).toEqual(
        plan.commands
          .filter(({ requiresCodexAssisted }) => requiresCodexAssisted !== true)
          .map(loggedCommand),
      );
      expect(await readFile(join(smokeDir, "user-override.css"), "utf8")).toContain(
        '@import url("./partial-template/style.css");',
      );

      await writeFile(commandLogPath, "", "utf8");
      const assistedResult = runHarness(
        [
          "run",
          "--input",
          inputPath,
          "--profile",
          profilePath,
          "--smoke-dir",
          smokeDir,
          "--allow-codex-assisted",
          "--template-heading-family",
          "Operator Heading",
        ],
        env,
      );

      expect(assistedResult.exitCode).toBe(0);
      expect(assistedResult.stderr).toBe("");
      expect(JSON.parse(assistedResult.stdout)).toEqual({
        category: "COMPLETE",
        commandCount: 9,
        skippedScenarios: ["interactive"],
      });
      const assistedCommands = await readExecutedSmokeCommands(commandLogPath);
      expect(assistedCommands).toEqual(plan.commands.map(loggedCommand));

      const cleanResult = runHarness(["clean", "--smoke-dir", smokeDir]);
      expect(cleanResult.exitCode).toBe(0);
      await expect(stat(smokeDir)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("run creates a missing production smoke root in an isolated repository", async () => {
    await withTempFixtureDir("markdown-pdf-profile-font-preservation-repo", async (fixtureDir) => {
      const isolatedRepo = join(fixtureDir, "repo");
      const isolatedScript = join(
        isolatedRepo,
        "scripts",
        "generate-markdown-pdf-profile-font-preservation-smoke.mjs",
      );
      const inputPath = join(isolatedRepo, "input.md");
      const profilePath = join(isolatedRepo, "profile.yml");
      const smokeRoot = join(isolatedRepo, "examples", "playground", "md-pdf", "smoke");
      const smokeDir = join(smokeRoot, "run");
      const stubBinDir = join(fixtureDir, "bin");
      const commandLogPath = join(fixtureDir, "commands.log");

      await mkdir(join(isolatedRepo, "scripts"), { recursive: true });
      await writeFile(isolatedScript, await readFile(join(REPO_ROOT, scriptPath), "utf8"), "utf8");
      await writeFile(inputPath, "# Isolated smoke\n", "utf8");
      await writeFile(profilePath, "fonts: {}\n", "utf8");
      await mkdir(join(isolatedRepo, "examples", "playground", "md-pdf"), {
        recursive: true,
      });
      await writeSmokeCommandStubs(stubBinDir);
      await expect(stat(smokeRoot)).rejects.toMatchObject({ code: "ENOENT" });

      const result = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", smokeDir],
        {
          PATH: stubBinDir,
          SMOKE_COMMAND_LOG: commandLogPath,
        },
        { cwd: isolatedRepo, script: isolatedScript },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(await readFile(join(smokeDir, ownershipMarkerName), "utf8")).toBe(
        ownershipMarkerContent,
      );

      const cleanResult = runHarness(["clean", "--smoke-dir", smokeDir], undefined, {
        cwd: isolatedRepo,
        script: isolatedScript,
      });
      expect(cleanResult.exitCode).toBe(0);
      await expect(stat(smokeDir)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("run stops at the first failed emitted command", async () => {
    await withSmokeFixture(async ({ inputPath, profilePath, smokeDir }) => {
      const stubBinDir = join(smokeDir, "..", "bin");
      const commandLogPath = join(smokeDir, "..", "commands.log");
      await writeSmokeCommandStubs(stubBinDir);

      const planResult = runHarness([
        "plan",
        "--input",
        inputPath,
        "--profile",
        profilePath,
        "--smoke-dir",
        smokeDir,
      ]);
      const plan = JSON.parse(planResult.stdout) as {
        commands: Array<{ argv: string[] }>;
      };
      const result = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", smokeDir],
        {
          PATH: stubBinDir,
          SMOKE_COMMAND_LOG: commandLogPath,
          SMOKE_FAIL_PATTERN: "md pdf-project codex",
        },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Smoke command failed: complete-project-generate (exit 7).");
      expect(await readExecutedSmokeCommands(commandLogPath)).toEqual(
        plan.commands.slice(0, 4).map(({ argv }) => `${argv[0]}\t${argv.slice(1).join(" ")}`),
      );
    });
  });

  test("clean refuses the smoke root and arbitrary scratch directories", async () => {
    const smokeRoot = join(REPO_ROOT, "examples", "playground", "md-pdf", "smoke");
    const rootResult = runHarness(["clean", "--smoke-dir", smokeRoot]);
    expect(rootResult.exitCode).toBe(1);
    expect(rootResult.stderr).toContain("Refusing to use a smoke directory");

    await withTempFixtureDir("unrelated-smoke", async (unsafeDir) => {
      const keepPath = join(unsafeDir, "keep.txt");
      await writeFile(keepPath, "keep", "utf8");
      const result = runHarness(["clean", "--smoke-dir", unsafeDir]);
      expect(result.exitCode).toBe(1);
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("clean and run refuse a symbolic-link smoke target", async () => {
    await withSmokeFixture(async ({ inputPath, profilePath, smokeDir }) => {
      const fixtureRoot = join(smokeDir, "..");
      const victimDir = join(fixtureRoot, "victim");
      const aliasDir = join(fixtureRoot, "alias");
      const keepPath = join(victimDir, "keep.txt");
      await mkdir(victimDir, { recursive: true });
      await writeFile(keepPath, "keep", "utf8");
      await symlink(victimDir, aliasDir);

      const cleanResult = runHarness(["clean", "--smoke-dir", aliasDir]);
      expect(cleanResult.exitCode).toBe(1);
      expect(cleanResult.stderr).toContain("symbolic-link path component");

      const runResult = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", aliasDir],
        { PATH: "" },
      );
      expect(runResult.exitCode).toBe(1);
      expect(runResult.stderr).toContain("symbolic-link path component");
      expect(runResult.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("run reports stable missing capabilities without altering outputs", async () => {
    await withSmokeFixture(async ({ inputPath, profilePath, smokeDir }) => {
      await mkdir(smokeDir, { recursive: true });
      const keepPath = join(smokeDir, "keep.txt");
      await writeFile(keepPath, "keep", "utf8");

      const result = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", smokeDir],
        { PATH: "" },
      );

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(JSON.parse(result.stderr)).toEqual({
        category: "UNAVAILABLE",
        missingCommands: ["bun", "pandoc", "weasyprint"],
      });
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("run rejects a missing Markdown input before cleanup or capability checks", async () => {
    await withSmokeFixture(async ({ profilePath, smokeDir }) => {
      await mkdir(smokeDir, { recursive: true });
      const keepPath = join(smokeDir, "keep.txt");
      await writeFile(keepPath, "keep", "utf8");

      const result = runHarness(
        [
          "run",
          "--input",
          join(smokeDir, "..", "missing-input.md"),
          "--profile",
          profilePath,
          "--smoke-dir",
          smokeDir,
        ],
        { PATH: "" },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Markdown input must exist as a regular file");
      expect(result.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("run rejects a missing Profile before cleanup or capability checks", async () => {
    await withSmokeFixture(async ({ inputPath, smokeDir }) => {
      await mkdir(smokeDir, { recursive: true });
      const keepPath = join(smokeDir, "keep.txt");
      await writeFile(keepPath, "keep", "utf8");

      const result = runHarness(
        [
          "run",
          "--input",
          inputPath,
          "--profile",
          join(smokeDir, "..", "missing-profile.yml"),
          "--smoke-dir",
          smokeDir,
        ],
        { PATH: "" },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("operator Profile must exist as a regular file");
      expect(result.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("plan and run reject Markdown input inside the smoke directory before cleanup", async () => {
    await withSmokeFixture(async ({ profilePath, smokeDir }) => {
      await mkdir(smokeDir, { recursive: true });
      const inputPath = join(smokeDir, "input.md");
      const keepPath = join(smokeDir, "keep.txt");
      await writeFile(inputPath, "# Keep this input\n", "utf8");
      await writeFile(keepPath, "keep", "utf8");

      const planResult = runHarness([
        "plan",
        "--input",
        inputPath,
        "--profile",
        profilePath,
        "--smoke-dir",
        smokeDir,
      ]);
      expect(planResult.exitCode).toBe(1);
      expect(planResult.stderr).toContain("Markdown input located inside the smoke directory");

      const runResult = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", smokeDir],
        { PATH: "" },
      );
      expect(runResult.exitCode).toBe(1);
      expect(runResult.stderr).toContain("Markdown input located inside the smoke directory");
      expect(runResult.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(inputPath, "utf8")).toBe("# Keep this input\n");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("plan and run reject a Profile inside the smoke directory before cleanup", async () => {
    await withSmokeFixture(async ({ inputPath, smokeDir }) => {
      await mkdir(smokeDir, { recursive: true });
      const profilePath = join(smokeDir, "operator-profile.yml");
      const keepPath = join(smokeDir, "keep.txt");
      await writeFile(profilePath, "fonts: {}\n", "utf8");
      await writeFile(keepPath, "keep", "utf8");

      const planResult = runHarness([
        "plan",
        "--input",
        inputPath,
        "--profile",
        profilePath,
        "--smoke-dir",
        smokeDir,
      ]);
      expect(planResult.exitCode).toBe(1);
      expect(planResult.stderr).toContain("Profile located inside the smoke directory");

      const runResult = runHarness(
        ["run", "--input", inputPath, "--profile", profilePath, "--smoke-dir", smokeDir],
        { PATH: "" },
      );
      expect(runResult.exitCode).toBe(1);
      expect(runResult.stderr).toContain("Profile located inside the smoke directory");
      expect(runResult.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(profilePath, "utf8")).toBe("fonts: {}\n");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("run rejects a Markdown input alias that resolves inside the smoke directory", async () => {
    await withSmokeFixture(async ({ profilePath, smokeDir }) => {
      const fixtureRoot = join(smokeDir, "..");
      const aliasDir = join(fixtureRoot, "input-alias");
      const inputPath = join(smokeDir, "input.md");
      const keepPath = join(smokeDir, "keep.txt");
      await mkdir(smokeDir, { recursive: true });
      await writeFile(inputPath, "# Keep this input\n", "utf8");
      await writeFile(keepPath, "keep", "utf8");
      await symlink(smokeDir, aliasDir);

      const planResult = runHarness([
        "plan",
        "--input",
        join(aliasDir, "input.md"),
        "--profile",
        profilePath,
        "--smoke-dir",
        smokeDir,
      ]);
      expect(planResult.exitCode).toBe(1);
      expect(planResult.stderr).toContain("Markdown input located inside the smoke directory");

      const result = runHarness(
        [
          "run",
          "--input",
          join(aliasDir, "input.md"),
          "--profile",
          profilePath,
          "--smoke-dir",
          smokeDir,
        ],
        { PATH: "" },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Markdown input located inside the smoke directory");
      expect(result.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(inputPath, "utf8")).toBe("# Keep this input\n");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });

  test("run rejects a Profile alias that resolves inside the smoke directory", async () => {
    await withSmokeFixture(async ({ inputPath, smokeDir }) => {
      const fixtureRoot = join(smokeDir, "..");
      const aliasDir = join(fixtureRoot, "profile-alias");
      const profilePath = join(smokeDir, "operator-profile.yml");
      const keepPath = join(smokeDir, "keep.txt");
      await mkdir(smokeDir, { recursive: true });
      await writeFile(profilePath, "fonts: {}\n", "utf8");
      await writeFile(keepPath, "keep", "utf8");
      await symlink(smokeDir, aliasDir);

      const planResult = runHarness([
        "plan",
        "--input",
        inputPath,
        "--profile",
        join(aliasDir, "operator-profile.yml"),
        "--smoke-dir",
        smokeDir,
      ]);
      expect(planResult.exitCode).toBe(1);
      expect(planResult.stderr).toContain("Profile located inside the smoke directory");

      const result = runHarness(
        [
          "run",
          "--input",
          inputPath,
          "--profile",
          join(aliasDir, "operator-profile.yml"),
          "--smoke-dir",
          smokeDir,
        ],
        { PATH: "" },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Profile located inside the smoke directory");
      expect(result.stderr).not.toContain("UNAVAILABLE");
      expect(await readFile(profilePath, "utf8")).toBe("fonts: {}\n");
      expect(await readFile(keepPath, "utf8")).toBe("keep");
    });
  });
});
