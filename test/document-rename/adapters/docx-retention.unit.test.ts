import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prepareSmokeRetention } from "../../../scripts/docx-candidate/retention.mjs";

async function ownedTest(run: (repo: string, workspace: string) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "cdx-docx-retention-unit-"));
  const repo = join(root, "repo");
  const workspace = join(root, "workspace");
  try {
    await mkdir(repo);
    await mkdir(workspace);
    await run(repo, workspace);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function stage(workspace: string, format = "esm", id = "case-one", outcome = "passed") {
  const directory = join(workspace, "smoke-artifacts", format, id);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "input.docx"), "synthetic DOCX bytes");
  await writeFile(
    join(directory, "result.json"),
    JSON.stringify({
      id,
      format,
      outcome,
      read: { text: "Example" },
      evidence: { title: "Example" },
    }),
  );
  return directory;
}

async function summary(repo: string, location: string) {
  return JSON.parse(await readFile(join(repo, location, "summary.json"), "utf8"));
}

test("retention exports selected files into unique runs and requires all expected formats for completeness", async () => {
  await ownedTest(async (repo, workspace) => {
    const retention = await prepareSmokeRetention(repo, { expectedCaseIds: ["case-one"] });
    await stage(workspace);
    await stage(workspace, "cjs");
    await writeFile(join(workspace, "private-build.mjs"), "unselected build");
    const first = await retention.publish(workspace, { outcome: "passed" });
    const second = await retention.publish(workspace, { outcome: "passed" });
    expect(first).not.toBe(second);
    expect(first).toMatch(/^examples\/playground\/docx-candidate\/smoke\/run-[A-Za-z0-9]+$/);
    expect((await readdir(join(repo, first))).sort()).toEqual(["cjs", "esm", "summary.json"]);
    expect(await readFile(join(repo, first, "esm", "case-one", "input.docx"), "utf8")).toBe(
      "synthetic DOCX bytes",
    );
    expect(await summary(repo, first)).toMatchObject({
      schemaVersion: 1,
      scope: "smoke",
      outcome: "passed",
      complete: true,
      formats: {
        esm: { expected: 1, retained: 1, passed: 1 },
        cjs: { expected: 1, retained: 1, passed: 1 },
      },
    });
    expect(await readFile(join(repo, first, "esm", "case-one", "result.json"), "utf8")).toContain(
      '"text":"Example"',
    );
  });
});

test("failure and cancellation retain partial or summary-only results as incomplete", async () => {
  await ownedTest(async (repo, workspace) => {
    const retention = await prepareSmokeRetention(repo, {
      expectedCaseIds: ["case-one", "case-two"],
    });
    const empty = await retention.publish(workspace, { outcome: "failed" });
    expect(await summary(repo, empty)).toMatchObject({
      outcome: "failed",
      complete: false,
      formats: { esm: { retained: 0, passed: 0 } },
    });
    const directory = await stage(workspace, "esm", "case-one", "pending");
    await rm(join(directory, "result.json"));
    await mkdir(join(workspace, "smoke-artifacts", "esm", "case-two"));
    const partial = await retention.publish(workspace, { outcome: "cancelled" });
    expect(await summary(repo, partial)).toMatchObject({
      outcome: "cancelled",
      complete: false,
      formats: {
        esm: {
          retained: 2,
          passed: 0,
          cases: [
            { id: "case-one", outcome: "pending", complete: false },
            { id: "case-two", outcome: "pending", complete: false },
          ],
        },
      },
    });
    expect(await readdir(join(repo, partial, "esm", "case-one"))).toEqual(["input.docx"]);
    await stage(workspace, "esm", "case-one", "failed");
    const failed = await retention.publish(workspace, { outcome: "failed" });
    expect(await summary(repo, failed)).toMatchObject({
      outcome: "failed",
      complete: false,
      formats: { esm: { retained: 2, failed: 1, passed: 0 } },
    });
  });
});

test("passed publication rejects missing or pending cases and removes only its failed run", async () => {
  await ownedTest(async (repo, workspace) => {
    const retention = await prepareSmokeRetention(repo, { expectedCaseIds: ["case-one"] });
    const prior = await retention.publish(workspace, { outcome: "failed" });
    await stage(workspace, "esm", "case-one", "pending");
    await stage(workspace, "cjs");
    await expect(retention.publish(workspace, { outcome: "passed" })).rejects.toMatchObject({
      category: "runner",
    });
    expect(await readdir(join(repo, "examples/playground/docx-candidate/smoke"))).toEqual([
      prior.split("/").at(-1)!,
    ]);
    expect((await summary(repo, prior)).outcome).toBe("failed");
  });
});

test("retention rejects unsafe expected IDs and destination symlinks", async () => {
  await ownedTest(async (repo, workspace) => {
    for (const expectedCaseIds of [
      [],
      ["../escape"],
      ["a", "a"],
      Array.from({ length: 257 }, (_, index) => `a${index}`),
    ])
      await expect(prepareSmokeRetention(repo, { expectedCaseIds })).rejects.toMatchObject({
        category: "runner",
      });
    await symlink(workspace, join(repo, "examples"));
    await expect(
      prepareSmokeRetention(repo, { expectedCaseIds: ["case-one"] }),
    ).rejects.toMatchObject({ category: "runner" });
    expect(await readdir(workspace)).toEqual([]);
  });
});

test("aggregate export overflow rejects individually bounded files and preserves prior runs", async () => {
  await ownedTest(async (repo, workspace) => {
    const ids = Array.from({ length: 9 }, (_, index) => `case-${index}`);
    const retention = await prepareSmokeRetention(repo, { expectedCaseIds: ids });
    const prior = await retention.publish(workspace, { outcome: "failed" });
    for (const id of ids) {
      const directory = await stage(workspace, "esm", id);
      // Every file fits its individual bound; the combined inputs exceed 64 MiB.
      await truncate(join(directory, "input.docx"), 8 * 1024 * 1024);
    }
    await expect(retention.publish(workspace, { outcome: "failed" })).rejects.toMatchObject({
      category: "runner",
    });
    expect(await readdir(join(repo, "examples/playground/docx-candidate/smoke"))).toEqual([
      prior.split("/").at(-1)!,
    ]);
    expect((await summary(repo, prior)).outcome).toBe("failed");
  });
});

test("publication refuses substituted destination ancestors without deleting unrelated content", async () => {
  await ownedTest(async (repo, workspace) => {
    const retention = await prepareSmokeRetention(repo, { expectedCaseIds: ["case-one"] });
    await rm(join(repo, "examples/playground/docx-candidate/smoke"), { recursive: true });
    await symlink(workspace, join(repo, "examples/playground/docx-candidate/smoke"));
    await writeFile(join(workspace, "sentinel"), "preserve");
    await expect(retention.publish(workspace, { outcome: "failed" })).rejects.toMatchObject({
      category: "runner",
    });
    expect(await readFile(join(workspace, "sentinel"), "utf8")).toBe("preserve");
  });
});

test("export rejects source symlinks, unselected files, invalid JSON and oversized inputs", async () => {
  for (const variant of [
    "source-symlink",
    "file-symlink",
    "extra-file",
    "unknown-case",
    "invalid-json",
    "identity",
    "missing-evidence",
    "oversized",
    "oversized-result",
  ]) {
    await ownedTest(async (repo, workspace) => {
      const retention = await prepareSmokeRetention(repo, { expectedCaseIds: ["case-one"] });
      const directory = await stage(workspace);
      if (variant === "source-symlink") {
        await rm(join(workspace, "smoke-artifacts"), { recursive: true });
        await symlink(repo, join(workspace, "smoke-artifacts"));
      } else if (variant === "file-symlink") {
        await rm(join(directory, "input.docx"));
        await symlink(join(directory, "result.json"), join(directory, "input.docx"));
      } else if (variant === "extra-file")
        await writeFile(join(directory, "raw.log"), "private log");
      else if (variant === "unknown-case") await stage(workspace, "esm", "unknown-case");
      else if (variant === "invalid-json") await writeFile(join(directory, "result.json"), "{");
      else if (variant === "identity")
        await writeFile(
          join(directory, "result.json"),
          '{"id":"other","format":"esm","outcome":"passed"}',
        );
      else if (variant === "missing-evidence")
        await writeFile(
          join(directory, "result.json"),
          '{"id":"case-one","format":"esm","outcome":"passed"}',
        );
      else if (variant === "oversized-result")
        await truncate(join(directory, "result.json"), 2 * 1024 * 1024 + 1);
      else await truncate(join(directory, "input.docx"), 8 * 1024 * 1024 + 1);
      await expect(retention.publish(workspace, { outcome: "failed" })).rejects.toMatchObject({
        category: "runner",
      });
      expect(await readdir(join(repo, "examples/playground/docx-candidate/smoke"))).toEqual([]);
    });
  }
});
