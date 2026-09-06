import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { runCli, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("doctor command environment", () => {
  test("actionDoctor reports an invalid codex override as unavailable", async () => {
    await withTempFixtureDir("doctor-codex-override", async (fixtureDir) => {
      const invalidOverride = join(fixtureDir, "missing-codex");

      const result = runCli(["doctor", "--json"], undefined, {
        CDX_CHORES_CODEX_PATH: invalidOverride,
        CODEX_API_KEY: "test-key",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const payload = JSON.parse(result.stdout);
      expect(payload.queryCodex.configuredSupport).toBe(false);
      expect(payload.queryCodex.readyToDraft).toBe(false);
      expect(payload.queryCodex.authSessionAvailable).toBe(true);
      expect(payload.queryCodex.detail).toContain("Codex override path is not executable");
      expect(payload.queryCodex.detail).toContain(invalidOverride);
      expect(payload.capabilities["data.query.codex"]).toBe(false);
    });
  });
});
