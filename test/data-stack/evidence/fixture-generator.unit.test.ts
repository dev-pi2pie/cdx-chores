import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { fixtureGeneratorInternals } from "../../../scripts/generate-data-stack-fixtures.mjs";
import { REPO_ROOT } from "../../helpers/cli-test-utils";

async function snapshotDirectory(
  outputDir: string,
  prefix = "",
): Promise<Array<{ hash: string; name: string }>> {
  const names = (await readdir(join(outputDir, prefix), { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  const entries = [];
  for (const entry of names) {
    const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      entries.push(...(await snapshotDirectory(outputDir, relativeName)));
      continue;
    }
    const content = await readFile(join(outputDir, relativeName));
    const hash = createHash("sha256").update(content).digest("hex");
    entries.push({ hash, name: relativeName });
  }
  return entries;
}

describe("data stack fixture generator", () => {
  test("cleanup target policy rejects broad paths before recursive removal", () => {
    expect(() => {
      fixtureGeneratorInternals.assertSafeResetTarget(
        join(fixtureGeneratorInternals.scratchOutputRoot, "safe-case"),
      );
    }).not.toThrow();
    expect(() => {
      fixtureGeneratorInternals.assertSafeResetTarget(fixtureGeneratorInternals.defaultOutputDir);
    }).not.toThrow();

    expect(() => {
      fixtureGeneratorInternals.assertSafeCleanTarget(fixtureGeneratorInternals.defaultOutputDir);
    }).toThrow("Refusing to clean the default tracked stack fixture tree");
    expect(() => {
      fixtureGeneratorInternals.assertSafeResetTarget(REPO_ROOT);
    }).toThrow("Refusing to clean unsafe fixture output directory");
  });
});
