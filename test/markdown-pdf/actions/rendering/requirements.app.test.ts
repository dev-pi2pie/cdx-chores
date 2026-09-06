import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../../../../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf";
import { ok } from "./render-support";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";

describe("Markdown PDF rendering requirements", () => {
  test("rejects unsupported and unverified Pandoc versions before rendering", async () => {
    const cases = [
      {
        versionOutput: "pandoc 1.19.2\n",
        code: "DEPENDENCY_VERSION_UNSUPPORTED",
        messageIncludes: "md to-pdf requires pandoc 2.0 or newer",
      },
      {
        versionOutput: "pandoc custom-build\n",
        code: "DEPENDENCY_VERSION_UNKNOWN",
        messageIncludes: "Unable to verify the pandoc version",
      },
    ] as const;

    for (const scenario of cases) {
      await withTempFixtureDir("md-to-pdf-pandoc-version", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        await writeFile(inputPath, "# Report\n", "utf8");
        const calls: Array<{ command: string; args: string[] }> = [];
        const runner: MarkdownPdfProcessRunner = async (command, args) => {
          calls.push({ command, args });
          if (command === "pandoc" && args.includes("--version")) {
            return ok(scenario.versionOutput);
          }
          throw new Error(`unexpected command: ${command}`);
        };
        const { runtime, expectNoOutput } = createActionTestRuntime();

        await expectCliError(
          () =>
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              runner,
            }),
          {
            code: scenario.code,
            exitCode: 2,
            messageIncludes: scenario.messageIncludes,
          },
        );

        expect(calls).toEqual([{ command: "pandoc", args: ["--version"] }]);
        expectNoOutput();
      });
    }
  });
});
