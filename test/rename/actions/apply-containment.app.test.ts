import { describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameApply } from "../../../src/cli/actions";
import {
  createRenamePlanCsvRows,
  readRenamePlanCsv,
  writeRenamePlanCsv,
} from "../../../src/cli/rename-plan-csv";
import { expectCliError } from "../../helpers/cli-action-test-utils";
import { createCapturedRuntime, withTempFixtureDir } from "../../helpers/cli-test-utils";
import {
  createRenamePlanCsvText,
  createRenamePlanRow,
  RENAME_PLAN_HEADERS,
} from "./apply-validation-support";

describe("rename apply path containment", () => {
  test.each([
    ["alias/second.txt", "renamed.txt", "OUTPUT_SYMLINK", "old_path parent directory is a symlink"],
    [
      "nested/second.txt",
      "alias/renamed.txt",
      "OUTPUT_SYMLINK",
      "new_path parent directory is a symlink",
    ],
    [
      "nested/second.txt",
      "missing/renamed.txt",
      "INVALID_RENAME_PLAN",
      "new_path parent must be an existing directory",
    ],
    [
      "nested/second.txt",
      "first.txt/renamed.txt",
      "INVALID_INPUT",
      "new_path parent path is not a directory",
    ],
    [
      "nested",
      "renamed-directory",
      "INVALID_RENAME_PLAN",
      "old_path must be an existing regular file",
    ],
    [
      "linked.txt",
      "renamed.txt",
      "INVALID_RENAME_PLAN",
      "old_path must be an existing regular file",
    ],
    [
      "missing.txt",
      "renamed.txt",
      "INVALID_RENAME_PLAN",
      "old_path must be an existing regular file",
    ],
    ["nested/second.txt", "nested", "INVALID_RENAME_PLAN", "new_path cannot be a directory"],
  ] as const)("rejects %s to %s during preflight", async (from, to, code, messageIncludes) => {
    await withTempFixtureDir("rename-replay-preflight", async (cwd) => {
      const nested = join(cwd, "nested");
      await mkdir(nested);
      await symlink(nested, join(cwd, "alias"), process.platform === "win32" ? "junction" : "dir");
      await writeFile(join(cwd, "first.txt"), "first");
      await writeFile(join(nested, "second.txt"), "second");
      if (from === "linked.txt") {
        await symlink(join(nested, "second.txt"), join(cwd, from), "file");
      }
      const csv = "plan.csv";
      const text = createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
        createRenamePlanRow("first.txt", "first-renamed.txt"),
        createRenamePlanRow(from, to),
      ]);
      await writeFile(join(cwd, csv), text);
      const entriesBefore = (await readdir(cwd)).sort();

      const { runtime } = createCapturedRuntime({ cwd });
      await expectCliError(() => actionRenameApply(runtime, { csv }), {
        code,
        exitCode: 2,
        messageIncludes,
      });

      expect((await readdir(cwd)).sort()).toEqual(entriesBefore);
      expect(await readFile(join(cwd, "first.txt"), "utf8")).toBe("first");
      expect(await readdir(nested)).toEqual(["second.txt"]);
      expect(await readFile(join(nested, "second.txt"), "utf8")).toBe("second");
      expect(await readFile(join(cwd, csv), "utf8")).toBe(text);
    });
  });

  test("generates and replays a nested ..draft path from a canonicalized working directory", async () => {
    await withTempFixtureDir("rename-replay-canonical-root", async (fixture) => {
      const root = join(fixture, "workspace");
      const cwd = join(fixture, "workspace-alias");
      const nested = join("..draft", "nested");
      await mkdir(join(root, nested), { recursive: true });
      await symlink(root, cwd, process.platform === "win32" ? "junction" : "dir");
      await writeFile(join(root, nested, "old.txt"), "draft");

      const { runtime } = createCapturedRuntime({ cwd });
      const { rows } = createRenamePlanCsvRows({
        runtime,
        plans: [
          {
            fromPath: join(cwd, nested, "old.txt"),
            toPath: join(cwd, nested, "new.txt"),
            changed: true,
          },
        ],
      });
      expect(rows[0]?.old_path).toBe(join(nested, "old.txt"));
      const csv = await writeRenamePlanCsv(runtime, rows);
      const result = await actionRenameApply(runtime, { csv });

      expect(result.appliedCount).toBe(1);
      expect(await readdir(join(root, nested))).toEqual(["new.txt"]);
      expect(await readFile(join(root, nested, "new.txt"), "utf8")).toBe("draft");
      expect((await readRenamePlanCsv(runtime, csv)).rows[0]?.status).toBe("applied");
    });
  });
});
