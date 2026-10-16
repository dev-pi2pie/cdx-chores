import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { withTemporaryWorkspace } from "../../../scripts/docx-baseline/workspace.mjs";
import { REPO_ROOT } from "../../helpers/cli-test-utils";

test("baseline workspace removes generated files and unlinks dependencies without deleting them", async () => {
  const neighbor = await mkdtemp(join(tmpdir(), "docx-baseline-neighbor-"));
  let owned = "";
  try {
    const marker = join(neighbor, "keep.txt");
    await writeFile(marker, "preserve");
    const result = await withTemporaryWorkspace(async (workspace: string) => {
      owned = workspace;
      await mkdir(join(workspace, "inputs"));
      await writeFile(join(workspace, "inputs", "sample.docx"), "generated");
      await symlink(neighbor, join(workspace, "node_modules"), "junction");
      return "completed";
    });
    expect(result).toBe("completed");
    expect(existsSync(owned)).toBe(false);
    expect(await readFile(marker, "utf8")).toBe("preserve");
  } finally {
    await rm(neighbor, { recursive: true });
  }
});

test("baseline workspace removes partial build outputs when evaluation fails", async () => {
  let owned = "";
  const failure = new Error("evaluation failed");
  await expect(
    withTemporaryWorkspace(async (workspace: string) => {
      owned = workspace;
      await writeFile(join(workspace, "run.mjs"), "partial build");
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(existsSync(owned)).toBe(false);
});

test("Node baseline launcher isolates evaluation options and cleans its offline workspace", async () => {
  const parent = await mkdtemp(join(tmpdir(), "docx-baseline-launch-test-"));
  const legacyScratch = join(REPO_ROOT, "examples/playground/docx-baseline");
  const legacyScratchExisted = existsSync(legacyScratch);
  try {
    const output = execFileSync(
      "node",
      [
        "--input-type=module",
        "--eval",
        'process.env.NODE_OPTIONS = "--require=docx-baseline-invalid-preload"; await import(process.argv[1]);',
        pathToFileURL(join(REPO_ROOT, "scripts/docx-baseline/launch.mjs")).href,
        "offline",
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, TMPDIR: parent, TMP: parent, TEMP: parent },
        encoding: "utf8",
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    expect(output).toBe("offline: passed yes\n");
    expect(await readdir(parent)).toEqual([]);
    expect(existsSync(legacyScratch)).toBe(legacyScratchExisted);
  } finally {
    await rm(parent, { recursive: true });
  }
}, 40_000);

test("baseline capture requires an explicit stdout export request", () => {
  for (const mode of ["capture", "capture-contract"]) {
    const result = spawnSync("node", [join(REPO_ROOT, "scripts/docx-baseline/launch.mjs"), mode], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(`${mode}: passed no\n`);
    expect(result.stderr).toBe("");
  }
});
