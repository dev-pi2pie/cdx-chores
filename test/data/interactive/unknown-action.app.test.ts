import { describe, expect, test } from "bun:test";

import { handleDataInteractiveAction } from "../../../src/cli/interactive/data";
import type { DataInteractiveActionKey } from "../../../src/cli/interactive/menu";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

describe("interactive data action routing", () => {
  test("throws when the data handler receives an unknown action", async () => {
    const { runtime } = createCapturedRuntime();

    await expect(
      handleDataInteractiveAction(
        runtime,
        {
          runtimeConfig: {
            mode: "auto",
            autocomplete: {
              enabled: true,
              minChars: 1,
              maxSuggestions: 12,
              includeHidden: false,
            },
          },
          cwd: runtime.cwd,
          stdin: runtime.stdin,
          stdout: runtime.stdout,
        },
        "data:unknown" as DataInteractiveActionKey,
      ),
    ).rejects.toThrow("Unhandled interactive action: data:unknown");
  });
});
