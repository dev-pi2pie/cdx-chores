import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { EMBEDDED_PACKAGE_VERSION } from "../src/cli/program/version-embedded";
import { REPO_ROOT } from "./helpers/cli-test-utils";

describe("embedded version sync", () => {
  test("embedded CLI version matches package.json", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      version?: string;
    };
    const packageVersion = packageJson.version;

    expect(typeof packageVersion).toBe("string");
    expect(EMBEDDED_PACKAGE_VERSION).toBe(packageVersion as string);
  });

  test("build script regenerates the embedded version before bundling", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: { build?: string };
    };

    expect(packageJson.scripts?.build).toContain("node scripts/generate-embedded-version.mjs");
    expect(packageJson.scripts?.build).toContain("tsdown");
  });
});
