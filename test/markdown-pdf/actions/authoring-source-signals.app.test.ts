import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";

const harness = fileURLToPath(new URL("./fixtures/authoring-source-signals.ts", import.meta.url));

test("Profile, Template, and Project authoring agree with and without Pandoc on PATH", async () => {
  await withTempFixtureDir("md-pdf-authoring-source-signals", async (root) => {
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pandoc"),
      '#!/bin/sh\nprintf "unexpected Pandoc call" >&2\n: > pandoc-called\nexit 1\n',
      { mode: 0o755 },
    );

    const results = [];
    for (const [availability, PATH] of [
      ["present", bin],
      ["absent", ""],
    ] as const) {
      const cwd = join(root, availability);
      await mkdir(cwd);
      const child = startFixtureProcess({
        executable: process.execPath,
        args: [harness, availability],
        env: { ...process.env, PATH, TMPDIR: cwd },
        cwd,
        timeoutMs: 10_000,
        graceMs: 250,
        cleanupMs: 1_500,
      });
      child.child.stdin.end();
      const result = await child.completion;
      expect(result.stopped).toBe(true);
      expect(result.stderr).toBe("");
      expect(result.ok).toBe(true);
      results.push(JSON.parse(result.stdout));
    }
    expect(results[0]).toEqual(results[1]);
  });
}, 20_000);
