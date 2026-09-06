import { describe, expect, test } from "bun:test";

import { EMBEDDED_PACKAGE_VERSION } from "../../../src/cli/program/version-embedded";
import { runCli } from "../../helpers/cli-test-utils";

describe("CLI root command UX", () => {
  test("supports both -v and -V for version output", () => {
    const lower = runCli(["-v"]);
    const upper = runCli(["-V"]);

    expect(lower.exitCode).toBe(0);
    expect(upper.exitCode).toBe(0);
    expect(lower.stderr).toBe("");
    expect(upper.stderr).toBe("");
    expect(lower.stdout).toContain("cdx-chores");
    expect(upper.stdout).toContain("cdx-chores");
    expect(lower.stdout).toContain(`ver.${EMBEDDED_PACKAGE_VERSION}`);
    expect(upper.stdout).toContain(`ver.${EMBEDDED_PACKAGE_VERSION}`);
  });

  test("root help omits deferred docx and pdf command families", () => {
    const result = runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("docx");
    expect(result.stdout).not.toContain("pdf");
  });
});
