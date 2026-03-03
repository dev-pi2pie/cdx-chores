import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildCleanupUidBasenames } from "../src/cli/actions/rename/cleanup-uid";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("rename cleanup uid generation", () => {
  test("buildCleanupUidBasenames is deterministic and widens from the same digest", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "Meeting Notes 2026-03-02.txt");
      await writeFile(sourcePath, "fake", "utf8");

      const first = await buildCleanupUidBasenames(sourcePath);
      const second = await buildCleanupUidBasenames(sourcePath);

      expect(first).toEqual(second);
      expect(first).toHaveLength(3);
      expect(first[0]).toMatch(/^uid-[0-9a-hjkmnpqrstvwxyz]{10}$/);
      expect(first[1]).toMatch(/^uid-[0-9a-hjkmnpqrstvwxyz]{13}$/);
      expect(first[2]).toMatch(/^uid-[0-9a-hjkmnpqrstvwxyz]{16}$/);
      expect(first[1]?.startsWith(first[0]!)).toBe(true);
      expect(first[2]?.startsWith(first[1]!)).toBe(true);
    });
  });

  test("buildCleanupUidBasenames reuses an existing canonical uid basename", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "UID-7K3M9Q2X4T.txt");
      await writeFile(sourcePath, "fake", "utf8");

      await expect(buildCleanupUidBasenames(sourcePath)).resolves.toEqual(["uid-7k3m9q2x4t"]);
    });
  });
});
