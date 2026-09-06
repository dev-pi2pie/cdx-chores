import { describe, expect, test } from "bun:test";

import { runInteractiveDataQuery } from "../../../src/cli/interactive/data-query";
import { runInteractiveDataExtract } from "../../../src/cli/interactive/data/extract";
import { runInteractiveDataStack } from "../../../src/cli/interactive/data/stack";
import { resolvePathPromptRuntimeConfig } from "../../../src/cli/prompts/path-config";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

describe("interactive data entry validation", () => {
  for (const [label, run] of [
    ["query", runInteractiveDataQuery],
    ["extract", runInteractiveDataExtract],
    ["stack", runInteractiveDataStack],
  ] as const) {
    test(`${label} validates execution configuration before prompts or output`, async () => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      await expect(
        run(
          runtime,
          {
            cwd: runtime.cwd,
            stdin: runtime.stdin,
            stdout: runtime.stdout,
            runtimeConfig: resolvePathPromptRuntimeConfig({}),
          },
          30_000,
          { model: " " },
        ),
      ).rejects.toThrow("Codex model must be a non-empty string");
      expect(stdout.text + stderr.text).toBe("");
    });
  }
});
