import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { build } from "tsdown";

import { startFixtureProcess } from "../../../../scripts/testing/fixtures/fixture-process";
import { createTempFixtureDir, REPO_ROOT } from "../../../helpers/cli-test-utils";
import type { ExtractedDocumentTitleEvidence } from "../../../../src/adapters/codex/document-rename/types";
import type { DocxProductObservation } from "../docx-baseline/assertions";
import type { DocxBaselineCase } from "../docx-baseline/corpus/index";

/** No manual evaluation launchers: compile product entry points beside their fixed assets. */
export async function buildDocxProduct(root: string, formats: Array<"esm" | "cjs"> = ["esm"]) {
  await build({
    config: false,
    entry: {
      entry: join(import.meta.dir, "entry.ts"),
      driver: join(import.meta.dir, "driver.ts"),
      "docx-child": join(REPO_ROOT, "src/docx/runtime/docx-child.ts"),
      "docx-worker": join(REPO_ROOT, "src/docx/runtime/docx-worker.ts"),
      "docx-parser": join(REPO_ROOT, "src/docx/reader.ts"),
    },
    cwd: REPO_ROOT,
    outDir: root,
    platform: "node",
    target: "node22",
    format: formats,
    fixedExtension: true,
    dts: false,
    clean: false,
    logLevel: "silent",
    deps: { onlyBundle: [] },
  });
  await symlink(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "junction");
}

export async function createDocxProductFixture() {
  const root = await createTempFixtureDir("docx-product");
  let stopped = true;
  let closing = false;
  let cleanup: Promise<void> | undefined;
  const pending = new Set<Promise<unknown>>();
  try {
    await buildDocxProduct(root);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  function track<T>(work: () => Promise<T>): Promise<T> {
    assert(!closing, "DOCX product fixture is closing");
    const completion = work();
    pending.add(completion);
    void completion.then(
      () => pending.delete(completion),
      () => pending.delete(completion),
    );
    return completion;
  }

  async function runDriver(mode: string, args: string[]) {
    assert(!closing, "DOCX product fixture is closing");
    const batch = mode === "observe-many" || mode === "observe-direct";
    const owned = startFixtureProcess({
      executable: "node",
      args: [join(root, "driver.mjs"), mode, ...args],
      cwd: root,
      env: { PATH: process.env.PATH, NO_COLOR: "1" },
      timeoutMs: mode === "timeout-probe" ? 500 : batch ? 30_000 : 15_000,
      graceMs: 250,
      cleanupMs: 3_000,
      // The frozen semantic capture array is under 140 KiB; bound the batch payload.
      maxOutputBytes: batch ? 512 * 1024 : 65_536,
    });
    try {
      const result = await owned.completion;
      stopped &&= result.stopped;
      return result;
    } catch (error) {
      stopped = false;
      throw error;
    }
  }

  async function runJson(mode: string, args: string[]) {
    const result = await runDriver(mode, args);
    if (!result.stopped || !result.ok)
      throw new Error(
        `DOCX product fixture failed: ${JSON.stringify(result.issues)} ${result.stderr}`,
      );
    return JSON.parse(result.stdout) as unknown;
  }

  return {
    root,
    run(mode: string, ...args: string[]) {
      return track(() => runJson(mode, args));
    },
    probeTimeout() {
      return track(() => runDriver("timeout-probe", []));
    },
    async extract(path: string) {
      return (await this.run("extract", path)) as ExtractedDocumentTitleEvidence;
    },
    observeCases(
      cases: DocxBaselineCase[],
      options: { mode?: "direct" | "supervised"; deadline?: number } = {},
    ) {
      return track(async () => {
        assert(cases.length > 0 && cases.length <= 70, "Expected a bounded DOCX regression slice");
        assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
        const directory = await mkdtemp(join(root, "cases-"));
        const inputs = new Map<string, Buffer>();
        const requests: Array<{ id: string; path: string; directory: string }> = [];
        for (const item of cases) {
          const bytes =
            "fixture" in item.input
              ? await readFile(join(REPO_ROOT, item.input.fixture))
              : item.input.bytes;
          const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
          await mkdir(join(directory, item.id));
          const path = join(directory, item.id, name);
          await writeFile(path, bytes);
          inputs.set(item.id, bytes);
          requests.push({ id: item.id, path, directory });
        }
        const requestPath = join(directory, "observations.json");
        await writeFile(requestPath, JSON.stringify(requests));
        if (options.deadline !== undefined)
          assert(
            options.deadline - performance.now() >= 38_000,
            "DOCX batch has insufficient time for execution, termination, and result handling",
          );
        const mode = options.mode === "direct" ? "observe-direct" : "observe-many";
        const observations = (await runJson(mode, [requestPath])) as Array<{
          id: string;
          observation: DocxProductObservation;
        }>;
        assert.deepEqual(
          observations.map((value) => value.id),
          cases.map((item) => item.id),
          "Expected one ordered product observation for each DOCX input",
        );
        return new Map(
          observations.map(({ id, observation }) => [id, { bytes: inputs.get(id)!, observation }]),
        );
      });
    },
    cleanup() {
      closing = true;
      cleanup ??= (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // Leave room inside the 15-second teardown hook; a rejected deadline never removes files.
          await Promise.race([
            Promise.allSettled(pending),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    new Error("DOCX fixture settlement deadline exceeded; directory retained."),
                  ),
                12_000,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        if (!stopped) throw new Error("DOCX product fixture process cleanup remains unconfirmed.");
        await rm(root, { recursive: true, force: true });
      })();
      return cleanup;
    },
  };
}
