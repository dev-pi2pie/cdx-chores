import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { REPO_ROOT, expectSuccess, runCommand } from "./fixtures";

describe("release workflow helpers", () => {
  test("filters allowed release branches by remote-prefix policy", () => {
    const result = runCommand(
      "bash",
      [join(REPO_ROOT, "scripts", "filter-allowed-release-branches.sh")],
      {
        input: [
          "origin/main",
          "origin/beta",
          "origin/alpha-release",
          "origin/canary-nightly",
          "origin/dev",
          "origin/feature/devtools-cleanup",
          "origin/hotfix/beta-roll-forward",
          "origin/release/canary-checks",
        ].join("\n"),
      },
    );

    expectSuccess(result);
    expect(result.stdout.trim().split("\n")).toEqual([
      "origin/beta",
      "origin/alpha-release",
      "origin/canary-nightly",
      "origin/dev",
    ]);
  });
});
