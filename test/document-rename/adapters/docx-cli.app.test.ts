import { expect, test } from "bun:test";
import { which } from "bun";
import { cp, mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

const node = which("node");
if (!node) throw new Error("Node is required for candidate driver checks");

for (const script of ["launch.mjs", "measure-launch.mjs", "package-check.mjs"]) {
  test(`${script} handles help and invalid arguments before execution setup`, async () => {
    await withTempFixtureDir("docx-cli-entry", async (root) => {
      // No node_modules or execution tools: help must stay available before setup.
      const minimal = join(root, "minimal");
      await mkdir(join(minimal, "scripts"), { recursive: true });
      await cp(join(REPO_ROOT, "scripts/docx-candidate"), join(minimal, "scripts/docx-candidate"), {
        recursive: true,
      });
      await mkdir(join(minimal, "test/document-rename/fixtures"), { recursive: true });
      await cp(
        join(REPO_ROOT, "test/document-rename/fixtures/docx-package-process.mjs"),
        join(minimal, "test/document-rename/fixtures/docx-package-process.mjs"),
      );
      const temporary = join(root, "temporary");
      await mkdir(temporary);
      for (const args of [["--help"], ["-h"], ["--unknown"], ["--keep-artifacts"]]) {
        const help = args[0] === "--help" || args[0] === "-h";
        const result = await startFixtureProcess({
          executable: node,
          args: [join(minimal, "scripts/docx-candidate", script), ...args],
          cwd: root,
          env: {
            PATH: join(root, "unavailable-tools"),
            TMPDIR: temporary,
            TMP: temporary,
            TEMP: temporary,
            NO_COLOR: "",
            FORCE_COLOR: "1",
          },
          timeoutMs: 5_000,
          graceMs: 500,
          cleanupMs: 2_000,
          maxOutputBytes: 16_384,
        }).completion;
        expect(result.stopped).toBe(true);
        expect(result.exitCode).toBe(help ? 0 : 1);
        expect(help ? result.stderr : result.stdout).toBe("");
        const text = help ? result.stdout : result.stderr;
        expect(text).toContain(`node ./scripts/docx-candidate/${script}`);
        expect(text).toContain("Usage:");
        expect(text).not.toContain("\u001b[");
        expect(text).not.toContain("Temporary cleanup");
        expect(await readdir(temporary)).toEqual([]);
        expect((await readdir(minimal)).sort()).toEqual(["scripts", "test"]);
      }
    });
  }, 30_000);
}

async function copyCandidateRepo(root: string) {
  const repo = join(root, "repo");
  await mkdir(join(repo, "scripts"), { recursive: true });
  await cp(join(REPO_ROOT, "scripts/docx-candidate"), join(repo, "scripts/docx-candidate"), {
    recursive: true,
  });
  await symlink(join(REPO_ROOT, "scripts/docx-baseline"), join(repo, "scripts/docx-baseline"));
  for (const name of ["src", "test", "node_modules"])
    await symlink(join(REPO_ROOT, name), join(repo, name));
  return repo;
}

test("retained smoke exports actual ESM/CJS evidence and cleans working builds", async () => {
  await withTempFixtureDir("docx-smoke-retained", async (root) => {
    const repo = await copyCandidateRepo(root);
    const temporary = join(root, "temporary");
    await mkdir(temporary);
    const result = await startFixtureProcess({
      executable: node,
      args: [join(repo, "scripts/docx-candidate/launch.mjs"), "--smoke", "--keep-artifacts"],
      cwd: repo,
      env: { PATH: process.env.PATH, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
      timeoutMs: 90_000,
      graceMs: 2_000,
      cleanupMs: 4_000,
      maxOutputBytes: 128 * 1024,
    }).completion;
    expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toBe("guarded reader: passed yes\n");
    const location = result.stderr.match(/Retained smoke artifacts: (examples\/[^\n]+)/)?.[1];
    expect(location).toBeDefined();
    const retained = join(repo, location!);
    const summary = JSON.parse(await readFile(join(retained, "summary.json"), "utf8"));
    expect(summary).toMatchObject({
      scope: "smoke",
      outcome: "passed",
      complete: true,
      formats: { esm: { expected: 22, passed: 22 }, cjs: { expected: 22, passed: 22 } },
    });
    expect((await readdir(retained)).sort()).toEqual(["cjs", "esm", "summary.json"]);
    for (const format of ["esm", "cjs"]) {
      const sample = join(retained, format, "seed-metadata-rich");
      expect((await readdir(sample)).sort()).toEqual(["input.docx", "result.json"]);
      expect(await readFile(join(sample, "input.docx"))).toEqual(
        await readFile(join(REPO_ROOT, "test/fixtures/docs/metadata-rich.docx")),
      );
      const actual = JSON.parse(await readFile(join(sample, "result.json"), "utf8"));
      expect(actual).toMatchObject({
        id: "seed-metadata-rich",
        format,
        outcome: "passed",
        read: { ok: true },
        evidence: { titleCandidates: ["Quarterly Operating Plan 2026"] },
      });
    }
    expect(await readdir(temporary)).toEqual([]);
  });
}, 100_000);

test("a comparison assertion failure retains the runner input and actual failed evidence", async () => {
  await withTempFixtureDir("docx-smoke-comparison-failure", async (root) => {
    const repo = await copyCandidateRepo(root);
    // Inject a controlled reader into the owned copy, preserving frozen expectations.
    await writeFile(
      join(repo, "scripts/docx-candidate/adapter.ts"),
      [
        'export { readDocxDocument } from "../../src/docx/reader";',
        'import { createDocxSupervisor } from "../../src/docx/runtime/index";',
        "export const readCandidateDocx = createDocxSupervisor().read;",
        'export async function extractCandidateDocxEvidence() { return { reason: "controlled-failure" }; }',
      ].join("\n"),
    );
    const temporary = join(root, "temporary");
    await mkdir(temporary);
    const result = await startFixtureProcess({
      executable: node,
      args: [join(repo, "scripts/docx-candidate/launch.mjs"), "--smoke", "--keep-artifacts"],
      cwd: repo,
      env: { PATH: process.env.PATH, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
      timeoutMs: 60_000,
      graceMs: 2_000,
      cleanupMs: 4_000,
      maxOutputBytes: 128 * 1024,
    }).completion;
    expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("guarded reader: passed no\n");
    expect(result.stderr).toContain("case seed-metadata-rich");
    const location = result.stderr.match(/Retained smoke artifacts: (examples\/[^\n]+)/)?.[1];
    expect(location).toBeDefined();
    const retained = join(repo, location!);
    const summary = JSON.parse(await readFile(join(retained, "summary.json"), "utf8"));
    expect(summary).toMatchObject({
      outcome: "failed",
      complete: false,
      formats: { esm: { retained: 1, failed: 1, passed: 0 }, cjs: { retained: 0 } },
    });
    const sample = join(retained, "esm/seed-metadata-rich");
    expect(await readFile(join(sample, "input.docx"))).toEqual(
      await readFile(join(REPO_ROOT, "test/fixtures/docs/metadata-rich.docx")),
    );
    expect(JSON.parse(await readFile(join(sample, "result.json"), "utf8"))).toMatchObject({
      outcome: "failed",
      read: { ok: true },
      evidence: { reason: "controlled-failure" },
    });
    expect(await readdir(temporary)).toEqual([]);
  });
}, 70_000);

for (const mode of [
  "default",
  "failure",
  "cancel",
  "cancel-term",
  "unconfirmed",
  "export-failure",
]) {
  test(`retention driver preserves ${mode} outcome and ownership`, async () => {
    await withTempFixtureDir("docx-retention-driver", async (root) => {
      const temporary = join(root, "temporary");
      await mkdir(temporary);
      const result = await startFixtureProcess({
        executable: node,
        args: [
          join(REPO_ROOT, "test/document-rename/fixtures/docx-retention-driver.mjs"),
          mode,
          root,
        ],
        cwd: REPO_ROOT,
        env: { PATH: process.env.PATH, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
        timeoutMs: 10_000,
        graceMs: 1_000,
        cleanupMs: 4_000,
        maxOutputBytes: 32_768,
      }).completion;
      expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
      expect(result.exitCode).toBe(mode === "default" ? 0 : 1);
      expect(result.stdout).toBe(`guarded reader: passed ${mode === "default" ? "yes" : "no"}\n`);
      expect(result.stderr).not.toContain("private");
      const runs = join(root, "repo/examples/playground/docx-candidate/smoke");
      const names = mode === "default" ? [] : await readdir(runs);
      if (mode === "default") {
        expect(await readdir(join(root, "repo"))).toEqual([]);
        expect(result.stderr).not.toContain("Retained smoke artifacts:");
        expect(await readdir(root)).not.toContain("publication-attempted");
      } else if (mode === "unconfirmed" || mode === "export-failure") expect(names).toEqual([]);
      else {
        expect(names.length).toBe(1);
        const summary = JSON.parse(await readFile(join(runs, names[0]!, "summary.json"), "utf8"));
        expect(summary).toMatchObject({
          outcome: mode.startsWith("cancel") ? "cancelled" : "failed",
          complete: false,
          formats: { esm: { expected: 1, retained: 1, passed: 0 }, cjs: { retained: 0 } },
        });
      }
      if (mode === "unconfirmed") expect((await readdir(temporary)).length).toBe(1);
      else expect(await readdir(temporary)).toEqual([]);
    });
  }, 15_000);
}
