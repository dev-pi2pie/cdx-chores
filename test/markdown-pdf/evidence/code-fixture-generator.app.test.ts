import { describe, expect, test } from "bun:test";
import { lstat, mkdir, readdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  allocateRun,
  fixtureEnvironment,
  removeRun,
  suitePath,
  TEST_CONTEXT_ENV,
} from "../../../scripts/testing/run-context.ts";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

function runGenerator(args: string[], env?: NodeJS.ProcessEnv, executable = process.execPath) {
  const proc = Bun.spawnSync({
    cmd: [executable, "scripts/generate-markdown-pdf-code-fixtures.mjs", ...args],
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

async function listRelativeFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(join(root, prefix));
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry}` : entry;
    const entryStat = await stat(join(root, relative));
    if (entryStat.isDirectory()) {
      files.push(...(await listRelativeFiles(root, relative)));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

describe("markdown PDF code fixture generator", () => {
  test("managed reset preserves its fixture owner and rejects other namespaces and aliases", async () => {
    const run = await allocateRun(REPO_ROOT, ["app", "unit"], false);
    try {
      const otherRun = await allocateRun(REPO_ROOT, ["app"], false);
      try {
        const namespace = join(suitePath(run, "app", "scratch"), "fixtures");
        const owner = join(namespace, "markdown-pdf-code-managed");
        const otherOwner = join(namespace, "other-feature-owner");
        const otherSuiteOwner = join(
          suitePath(run, "unit", "scratch"),
          "fixtures",
          "markdown-pdf-code-managed",
        );
        const otherRunOwner = join(
          suitePath(otherRun, "app", "scratch"),
          "fixtures",
          "markdown-pdf-code-managed",
        );
        await Promise.all([
          mkdir(owner),
          mkdir(otherOwner),
          mkdir(otherSuiteOwner),
          mkdir(otherRunOwner),
        ]);
        const fixtureDir = join(owner, "fixtures");
        const smokeDir = join(owner, "smoke");
        await mkdir(fixtureDir);
        await mkdir(smokeDir);
        await writeFile(join(fixtureDir, "stale.md"), "stale fixture");
        await writeFile(join(smokeDir, "stale.html"), "stale smoke");
        const before = await lstat(owner);
        const env = { [TEST_CONTEXT_ENV]: fixtureEnvironment(run, "app") };
        const reset = runGenerator(
          ["reset", "--fixture-dir", fixtureDir, "--smoke-dir", smokeDir],
          env,
          "node",
        );
        expect(reset.exitCode, reset.stderr).toBe(0);
        expect(await listRelativeFiles(fixtureDir)).toContain("code-basic.md");
        expect(await listRelativeFiles(fixtureDir)).not.toContain("stale.md");
        await expect(stat(smokeDir)).rejects.toMatchObject({ code: "ENOENT" });
        const after = await lstat(owner);
        expect({ dev: after.dev, ino: after.ino }).toEqual({ dev: before.dev, ino: before.ino });

        const aliasOwner = join(namespace, "markdown-pdf-code-alias");
        await symlink(owner, aliasOwner);
        const aliasChild = join(owner, "data");
        await symlink(otherOwner, aliasChild);
        await writeFile(join(otherOwner, "keep.md"), "untouched");
        for (const rejected of [
          run.root,
          suitePath(run, "app", "scratch"),
          namespace,
          owner,
          join(otherOwner, "data"),
          join(otherSuiteOwner, "fixtures"),
          join(otherRunOwner, "fixtures"),
          join(aliasOwner, "fixtures"),
          aliasChild,
        ]) {
          const result = runGenerator(["clean", "--smoke-dir", rejected], env);
          expect(result.exitCode, rejected).toBe(1);
          expect(result.stderr).toContain("Refusing to clean smoke directory");
        }
        expect(await readFile(join(otherOwner, "keep.md"), "utf8")).toBe("untouched");
        expect(await listRelativeFiles(fixtureDir)).toContain("code-basic.md");
      } finally {
        await removeRun(otherRun);
      }
    } finally {
      await removeRun(run);
    }
  });

  test("reset creates committed Markdown and profile fixtures", async () => {
    await withTempFixtureDir("markdown-pdf-code-fixtures", async (fixtureOwner) => {
      const fixtureDir = join(fixtureOwner, "fixtures");
      await mkdir(fixtureDir);
      await withTempFixtureDir("markdown-pdf-code-smoke", async (smokeOwner) => {
        const smokeDir = join(smokeOwner, "smoke");
        await mkdir(smokeDir);
        const result = runGenerator([
          "reset",
          "--fixture-dir",
          fixtureDir,
          "--smoke-dir",
          smokeDir,
        ]);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("Reset Markdown PDF code fixtures");
        expect(await readFile(join(fixtureDir, "code-basic.md"), "utf8")).toContain("```js");
        expect(
          await readFile(join(fixtureDir, "profiles/code-line-numbers.yml"), "utf8"),
        ).toContain("lineNumbers: true");
        expect(
          await readFile(join(fixtureDir, "profiles/code-transformer-notation.yml"), "utf8"),
        ).toContain("transformerNotation: true");
        const combinedTransformerProfile = await readFile(
          join(fixtureDir, "profiles/code-transformer-notation-line-numbers.yml"),
          "utf8",
        );
        expect(combinedTransformerProfile).toContain("lineNumbers: true");
        expect(combinedTransformerProfile).toContain("transformerNotation: true");
        expect(
          await readFile(join(fixtureDir, "code-transformer-line-numbers-combined.md"), "utf8"),
        ).toContain("[!code highlight]");
        expect(await readFile(join(fixtureDir, "code-transformer-focus.md"), "utf8")).toContain(
          "[!code focus:2]",
        );
        const errorWarningFixture = await readFile(
          join(fixtureDir, "code-transformer-error-warning.md"),
          "utf8",
        );
        expect(errorWarningFixture).toContain("[!code error:2]");
        expect(errorWarningFixture).toContain("[!code warning:2]");
        expect(await listRelativeFiles(fixtureDir)).toEqual([
          "code-basic.md",
          "code-line-numbers.md",
          "code-mixed-content.md",
          "code-plain-and-unsupported.md",
          "code-transformer-diff.md",
          "code-transformer-error-warning.md",
          "code-transformer-focus.md",
          "code-transformer-highlight-line.md",
          "code-transformer-line-numbers-combined.md",
          "code-wrapping.md",
          "profiles/code-highlight-alt-theme.yml",
          "profiles/code-highlight-default.yml",
          "profiles/code-line-numbers.yml",
          "profiles/code-transformer-notation-line-numbers.yml",
          "profiles/code-transformer-notation.yml",
        ]);
      });
    });
  });

  test("reset removes stale fixture files", async () => {
    await withTempFixtureDir("markdown-pdf-code-stale-fixtures", async (fixtureOwner) => {
      const fixtureDir = join(fixtureOwner, "fixtures");
      await withTempFixtureDir("markdown-pdf-code-stale-smoke", async (smokeOwner) => {
        const smokeDir = join(smokeOwner, "smoke");
        await mkdir(smokeDir);
        await mkdir(join(fixtureDir, "profiles"), { recursive: true });
        await writeFile(join(fixtureDir, "stale.md"), "# Stale\n", "utf8");
        await writeFile(join(fixtureDir, "profiles/stale.yml"), "stale: true\n", "utf8");

        const result = runGenerator([
          "reset",
          "--fixture-dir",
          fixtureDir,
          "--smoke-dir",
          smokeDir,
        ]);

        expect(result.exitCode).toBe(0);
        expect(await listRelativeFiles(fixtureDir)).not.toContain("stale.md");
        expect(await listRelativeFiles(fixtureDir)).not.toContain("profiles/stale.yml");
      });
    });
  });

  test("reset removes stale smoke output files", async () => {
    await withTempFixtureDir("markdown-pdf-code-reset-fixtures", async (fixtureOwner) => {
      const fixtureDir = join(fixtureOwner, "fixtures");
      await mkdir(fixtureDir);
      await withTempFixtureDir("markdown-pdf-code-reset-smoke", async (smokeOwner) => {
        const smokeDir = join(smokeOwner, "smoke");
        await mkdir(join(smokeDir, "html"), { recursive: true });
        await writeFile(join(smokeDir, "html/stale.html"), "<html></html>\n", "utf8");

        const result = runGenerator([
          "reset",
          "--fixture-dir",
          fixtureDir,
          "--smoke-dir",
          smokeDir,
        ]);

        expect(result.exitCode).toBe(0);
        expect(await readFile(join(fixtureDir, "code-basic.md"), "utf8")).toContain("```js");
        await expect(stat(smokeDir)).rejects.toMatchObject({ code: "ENOENT" });
      });
    });
  });

  test("refuses to reset arbitrary fixture directories", async () => {
    await withTempFixtureDir("unsafe-fixture-root", async (fixtureOwner) => {
      const fixtureDir = join(fixtureOwner, "fixtures");
      await mkdir(fixtureDir);
      await withTempFixtureDir("markdown-pdf-code-safe-smoke", async (smokeOwner) => {
        const smokeDir = join(smokeOwner, "smoke");
        await mkdir(smokeDir);
        await writeFile(join(fixtureDir, "keep.md"), "# Keep\n", "utf8");
        await writeFile(join(smokeDir, "keep.html"), "<html></html>\n", "utf8");

        const result = runGenerator([
          "reset",
          "--fixture-dir",
          fixtureDir,
          "--smoke-dir",
          smokeDir,
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Refusing to reset fixture directory");
        expect(await readFile(join(fixtureDir, "keep.md"), "utf8")).toBe("# Keep\n");
        expect(await readFile(join(smokeDir, "keep.html"), "utf8")).toBe("<html></html>\n");
      });
    });
  });

  test("reset refuses arbitrary smoke output directories before fixture cleanup", async () => {
    await withTempFixtureDir("markdown-pdf-code-safe-fixtures", async (fixtureOwner) => {
      const fixtureDir = join(fixtureOwner, "fixtures");
      await mkdir(fixtureDir);
      await withTempFixtureDir("unsafe-smoke-root", async (smokeOwner) => {
        const smokeDir = join(smokeOwner, "smoke");
        await mkdir(smokeDir);
        await writeFile(join(fixtureDir, "keep.md"), "# Keep\n", "utf8");
        await writeFile(join(smokeDir, "keep.html"), "<html></html>\n", "utf8");

        const result = runGenerator([
          "reset",
          "--fixture-dir",
          fixtureDir,
          "--smoke-dir",
          smokeDir,
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Refusing to clean smoke directory");
        expect(await readFile(join(smokeDir, "keep.html"), "utf8")).toBe("<html></html>\n");
        expect(await readFile(join(fixtureDir, "keep.md"), "utf8")).toBe("# Keep\n");
      });
    });
  });

  test("clean removes only the configured smoke output directory", async () => {
    await withTempFixtureDir("markdown-pdf-code-clean", async (rootDir) => {
      const fixtureDir = join(rootDir, "fixtures");
      const smokeDir = join(rootDir, "smoke");
      await mkdir(fixtureDir, { recursive: true });
      await mkdir(smokeDir, { recursive: true });
      await writeFile(join(fixtureDir, "keep.md"), "# Keep\n", "utf8");
      await writeFile(join(smokeDir, "remove.html"), "<html></html>\n", "utf8");

      const result = runGenerator(["clean", "--smoke-dir", smokeDir]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(await listRelativeFiles(fixtureDir)).toEqual(["keep.md"]);
      await expect(stat(smokeDir)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("clean refuses arbitrary smoke output directories", async () => {
    await withTempFixtureDir("unsafe-smoke-root", async (smokeOwner) => {
      const smokeDir = join(smokeOwner, "smoke");
      await mkdir(smokeDir, { recursive: true });
      await writeFile(join(smokeDir, "keep.html"), "<html></html>\n", "utf8");

      const result = runGenerator(["clean", "--smoke-dir", smokeDir]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Refusing to clean smoke directory");
      expect(await readFile(join(smokeDir, "keep.html"), "utf8")).toBe("<html></html>\n");
    });
  });

  test("smoke skips cleanly when Pandoc or WeasyPrint is unavailable", async () => {
    await withTempFixtureDir("markdown-pdf-code-smoke-skip", async (rootDir) => {
      const result = runGenerator(
        [
          "smoke",
          "--fixture-dir",
          join(rootDir, "fixtures"),
          "--smoke-dir",
          join(rootDir, "smoke"),
        ],
        { PATH: "" },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Skipping Markdown PDF code smoke");
      expect(result.stderr).toBe("");
    });
  });

  test("smoke refuses arbitrary smoke output directories", async () => {
    await withTempFixtureDir("markdown-pdf-code-smoke-fixtures", async (fixtureOwner) => {
      const fixtureDir = join(fixtureOwner, "fixtures");
      await mkdir(fixtureDir);
      await withTempFixtureDir("unsafe-smoke-root", async (smokeOwner) => {
        const smokeDir = join(smokeOwner, "smoke");
        await mkdir(smokeDir);
        await writeFile(join(smokeDir, "keep.html"), "<html></html>\n", "utf8");

        const result = runGenerator(
          ["smoke", "--fixture-dir", fixtureDir, "--smoke-dir", smokeDir],
          { PATH: "" },
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Refusing to clean smoke directory");
        expect(result.stdout).toBe("");
        expect(await readFile(join(smokeDir, "keep.html"), "utf8")).toBe("<html></html>\n");
      });
    });
  });
});
