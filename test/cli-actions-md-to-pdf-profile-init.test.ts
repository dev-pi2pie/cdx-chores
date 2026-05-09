import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfProfileInit } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf profile init", () => {
  test("writes a default YAML profile file", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfProfileInit(runtime, {
        output: toRepoRelativePath(outputPath),
      });

      const profile = await readFile(outputPath, "utf8");
      expect(profile).toContain("page:");
      expect(profile).toContain("pageNumbers:");
      expect(profile).toContain("enabled: false");
      expect(stdout.text).toContain("Wrote Markdown PDF profile:");
      expectNoStderr();
    });
  });

  test("writes a JSON profile file with preset-derived values", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.json");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfProfileInit(runtime, {
        output: toRepoRelativePath(outputPath),
        preset: "wide-table",
      });

      const profile = JSON.parse(await readFile(outputPath, "utf8")) as {
        page: { orientation: string; marginTop: string };
      };
      expect(profile.page.orientation).toBe("landscape");
      expect(profile.page.marginTop).toBe("12mm");
      expectNoStderr();
    });
  });

  test("rejects unknown profile extensions", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.txt");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfProfileInit(runtime, {
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "must end with .yml, .yaml, or .json",
        },
      );

      expectNoOutput();
    });
  });

  test("refuses an existing profile file without overwrite", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(outputPath, "existing", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfProfileInit(runtime, {
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );

      expectNoOutput();
    });
  });
});
