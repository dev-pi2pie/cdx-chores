import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { actionRenameFile } from "../../../src/cli/actions";
import { createCapturedRuntime, withTempFixtureDir } from "../../helpers/cli-test-utils";
import { withRenamePlanCsvCleanup } from "../support/run-cli";

function createPlanCsvPath(workspace: string): string {
  return join(workspace, `rename-plan-20260824T010101Z-${randomBytes(4).toString("hex")}.csv`);
}

describe("Rename CLI plan artifact lifecycle", () => {
  test("concurrent rename actions keep plans inside their owners across independent cleanup", async () => {
    await withTempFixtureDir("rename-surviving-owner", async (otherWorkspace) => {
      const evidence = await withTempFixtureDir("rename-completing-owner", async (workspace) => {
        const results = await Promise.all(
          [workspace, otherWorkspace].map(async (cwd) => {
            writeFileSync(join(cwd, "source.txt"), "source", "utf8");
            const { runtime } = createCapturedRuntime({ cwd });
            return await actionRenameFile(runtime, { path: "source.txt", dryRun: true });
          }),
        );
        const completedPlan = results[0]!.planCsvPath;
        const otherPlan = results[1]!.planCsvPath;
        if (!completedPlan || !otherPlan) throw new Error("Both owners must produce a rename plan");
        expect(completedPlan).toStartWith(`${workspace}/`);
        expect(otherPlan).toStartWith(`${otherWorkspace}/`);
        return { completedPlan, otherPlan, otherContents: readFileSync(otherPlan, "utf8") };
      });

      expect(existsSync(evidence.completedPlan)).toBe(false);
      expect(readFileSync(evidence.otherPlan, "utf8")).toBe(evidence.otherContents);
    });
  });

  for (const fails of [false, true]) {
    test(`cleans its plans after ${fails ? "throwing" : "returning"} and preserves another active owner`, async () => {
      await withTempFixtureDir("rename-owner", async (workspace) => {
        await withTempFixtureDir("rename-other-owner", async (otherWorkspace) => {
          const preExistingPath = createPlanCsvPath(workspace);
          const createdPath = createPlanCsvPath(workspace);
          const otherPath = createPlanCsvPath(otherWorkspace);
          const failure = new Error("rename runner failed");
          writeFileSync(preExistingPath, "pre-existing\n", "utf8");

          const run = () =>
            withRenamePlanCsvCleanup(workspace, () => {
              writeFileSync(createdPath, "created\n", "utf8");
              // A different invocation writes after this owner's snapshot.
              writeFileSync(otherPath, "other owner\n", "utf8");
              if (fails) throw failure;
              return "complete";
            });
          if (fails) expect(run).toThrow(failure);
          else expect(run()).toBe("complete");

          expect(existsSync(createdPath)).toBe(false);
          expect(readFileSync(preExistingPath, "utf8")).toBe("pre-existing\n");
          expect(readFileSync(otherPath, "utf8")).toBe("other owner\n");
        });
      });
    });
  }
});
