import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { EMBEDDED_PACKAGE_VERSION } from "../../src/cli/program/version-embedded";
import { REPO_ROOT } from "./fixtures";

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
    const buildScript = packageJson.scripts?.build ?? "";
    const generatorIndex = buildScript.indexOf("node scripts/generate-embedded-version.mjs");
    const tsdownIndex = buildScript.indexOf("tsdown");

    expect(generatorIndex).toBeGreaterThanOrEqual(0);
    expect(tsdownIndex).toBeGreaterThan(generatorIndex);
  });
});
