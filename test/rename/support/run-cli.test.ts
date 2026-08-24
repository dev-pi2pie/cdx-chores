import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../../helpers/cli-test-utils";

import { withRenamePlanCsvCleanup } from "./run-cli";

function createPlanCsvPath(): string {
  return join(REPO_ROOT, `rename-plan-20260824T010101Z-${randomBytes(4).toString("hex")}.csv`);
}

describe("Rename CLI plan artifact lifecycle", () => {
  test("removes newly created plans after returning and preserves pre-existing plans", () => {
    const preExistingPath = createPlanCsvPath();
    const createdPath = createPlanCsvPath();
    writeFileSync(preExistingPath, "pre-existing\n", "utf8");

    try {
      const result = withRenamePlanCsvCleanup(() => {
        writeFileSync(createdPath, "created\n", "utf8");
        return "complete";
      });

      expect(result).toBe("complete");
      expect(existsSync(createdPath)).toBe(false);
      expect(existsSync(preExistingPath)).toBe(true);
    } finally {
      rmSync(preExistingPath, { force: true });
      rmSync(createdPath, { force: true });
    }
  });

  test("removes newly created plans after throwing and preserves pre-existing plans", () => {
    const preExistingPath = createPlanCsvPath();
    const createdPath = createPlanCsvPath();
    const failure = new Error("rename runner failed");
    writeFileSync(preExistingPath, "pre-existing\n", "utf8");

    try {
      expect(() =>
        withRenamePlanCsvCleanup(() => {
          writeFileSync(createdPath, "created\n", "utf8");
          throw failure;
        }),
      ).toThrow(failure);

      expect(existsSync(createdPath)).toBe(false);
      expect(existsSync(preExistingPath)).toBe(true);
    } finally {
      rmSync(preExistingPath, { force: true });
      rmSync(createdPath, { force: true });
    }
  });
});
