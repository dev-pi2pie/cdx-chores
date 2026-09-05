import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToDocx } from "../../../src/cli/actions";
import type { DependencyCommandRunner } from "../../../src/cli/deps";
import type { ExecCommandResult } from "../../../src/cli/process";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

function ok(stdout = "", stderr = ""): ExecCommandResult {
  return {
    ok: true,
    code: 0,
    signal: null,
    stdout,
    stderr,
  };
}

function createDocxRunner() {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runner: DependencyCommandRunner = async (command, args, options) => {
    calls.push({ command, args, cwd: options?.cwd });

    if (command === "pandoc" && args.includes("--version")) {
      return ok("pandoc 3.1\n");
    }

    if (command === "pandoc") {
      const outputIndex = args.indexOf("-o");
      const outputPath = args[outputIndex + 1];
      if (!outputPath) {
        return {
          ok: false,
          code: 1,
          signal: null,
          stdout: "",
          stderr: "missing output",
        };
      }
      await writeFile(outputPath, "docx bytes", "utf8");
      return ok();
    }

    throw new Error(`unexpected command: ${command}`);
  };

  return { calls, runner };
}

describe("Markdown DOCX action rendering", () => {
  test("actionMdToDocx rejects missing input before dependency execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.md");

      await expectCliError(() => actionMdToDocx(runtime, { input: toRepoRelativePath(missing) }), {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
        messageIncludes: "Input file not found:",
      });

      expectNoOutput();
    });
  });

  test("actionMdToDocx renders DOCX output with an injected runner", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.docx");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createDocxRunner();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToDocx(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        runner,
      });

      expect(calls.map((call) => call.args)).toEqual([
        ["--version"],
        [inputPath, "-o", outputPath],
      ]);
      expect(await readFile(outputPath, "utf8")).toBe("docx bytes");
      expect(stdout.text).toContain("Wrote DOCX:");
      expectNoStderr();
    });
  });

  test("actionMdToDocx refuses existing output without overwrite", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.docx");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outputPath, "existing", "utf8");
      const { calls, runner } = createDocxRunner();
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToDocx(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            runner,
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );

      expect(calls.map((call) => call.args)).toEqual([["--version"]]);
      expect(await readFile(outputPath, "utf8")).toBe("existing");
      expectNoOutput();
    });
  });

  test("actionMdToDocx overwrites existing output when requested", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.docx");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outputPath, "existing", "utf8");
      const { calls, runner } = createDocxRunner();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToDocx(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        runner,
      });

      expect(calls.map((call) => call.args)).toEqual([
        ["--version"],
        [inputPath, "-o", outputPath],
      ]);
      expect(await readFile(outputPath, "utf8")).toBe("docx bytes");
      expect(stdout.text).toContain("Wrote DOCX:");
      expectNoStderr();
    });
  });
});
