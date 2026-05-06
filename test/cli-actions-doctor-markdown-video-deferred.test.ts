import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  actionDataDuckDbDoctor,
  actionDataDuckDbExtensionInstall,
  actionDoctor,
  actionMdToDocx,
  actionVideoConvert,
  actionVideoGif,
  actionVideoResize,
} from "../src/cli/actions";
import { inspectCommand } from "../src/cli/deps";
import type { ExecCommandResult } from "../src/cli/process";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function ok(stdout = "", stderr = ""): ExecCommandResult {
  return {
    ok: true,
    code: 0,
    signal: null,
    stdout,
    stderr,
  };
}

describe("cli action modules: doctor", () => {
  test("actionDoctor emits machine-readable JSON payload", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime, { json: true });

    expectNoStderr();
    const payload = JSON.parse(stdout.text);
    expect(typeof payload.generatedAt).toBe("string");
    expect(payload.platform).toBe(process.platform);
    expect(typeof payload.nodeVersion).toBe("string");
    expect(payload.tools).toHaveProperty("pandoc");
    expect(payload.tools).toHaveProperty("ffmpeg");
    expect(payload.tools).toHaveProperty("weasyprint");
    expect(typeof payload.tools.pandoc.available).toBe("boolean");
    expect(typeof payload.tools.ffmpeg.available).toBe("boolean");
    expect(typeof payload.tools.weasyprint.available).toBe("boolean");
    expect(Object.hasOwn(payload.capabilities, "md.to-docx")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "md.to-pdf")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "video.gif")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "data.query.csv")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "data.query.duckdb")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "data.query.codex")).toBe(true);
    expect(payload.query).toBeDefined();
    expect(typeof payload.query.available).toBe("boolean");
    if (payload.query.available) {
      expect(typeof payload.query.runtimeVersion).toBe("string");
    }
    expect(payload.query.formats).toHaveProperty("csv");
    expect(payload.query.formats).toHaveProperty("duckdb");
    expect(payload.query.formats).toHaveProperty("sqlite");
    expect(payload.query.formats.csv.kind).toBe("core");
    expect(payload.query.formats.duckdb.kind).toBe("core");
    expect(typeof payload.query.formats.csv.detectedSupport).toBe("boolean");
    expect(typeof payload.query.formats.duckdb.detectedSupport).toBe("boolean");
    expect(Object.hasOwn(payload.query.formats.csv, "loadability")).toBe(false);
    expect(payload.query.formats.sqlite.kind).toBe("extension");
    expect(typeof payload.query.formats.sqlite.loadability).toBe("boolean");
    expect(payload.queryCodex).toBeDefined();
    expect(typeof payload.queryCodex.configuredSupport).toBe("boolean");
    expect(typeof payload.queryCodex.authSessionAvailable).toBe("boolean");
    expect(typeof payload.queryCodex.readyToDraft).toBe("boolean");
  });

  test("actionDoctor emits human-readable text report", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime);

    expectNoStderr();
    expect(stdout.text).toContain("cdx-chores doctor");
    expect(stdout.text).toContain("Platform:");
    expect(stdout.text).toContain("Node.js:");
    expect(stdout.text).toContain("Capabilities:");
    expect(stdout.text).toContain("md.to-docx");
    expect(stdout.text).toContain("md.to-pdf");
    expect(stdout.text).toContain("weasyprint");
    expect(stdout.text).toContain("video.gif");
    expect(stdout.text).toContain("Data query formats:");
    expect(stdout.text).toContain("Data query Codex:");
    expect(stdout.text).toContain("csv: built-in DuckDB support=");
    expect(stdout.text).toContain("duckdb: built-in DuckDB support=");
    expect(stdout.text).toContain("sqlite: detected support=");
    expect(stdout.text).toContain("ready-to-draft=");
    expect(stdout.text).not.toContain("csv: detected support=");
    expect(stdout.text).not.toContain(
      "csv: detected support=yes, loadability=yes, installability=unknown",
    );
  });

  test("actionDataDuckDbDoctor emits human-readable DuckDB extension report", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDataDuckDbDoctor(runtime);

    expectNoStderr();
    expect(stdout.text).toContain("cdx-chores data duckdb doctor");
    expect(stdout.text).toContain("DuckDB runtime:");
    expect(stdout.text).toContain("Managed extensions:");
    expect(stdout.text).toContain("sqlite:");
    expect(stdout.text).toContain("excel:");
  });

  test("actionDataDuckDbExtensionInstall requires an extension name unless --all-supported is used", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(() => actionDataDuckDbExtensionInstall(runtime, {}), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "Extension name is required unless --all-supported is used",
    });

    expectNoOutput();
  });

  test("actionDoctor reports an invalid codex override as unavailable", async () => {
    await withTempFixtureDir("doctor-codex-override", async (fixtureDir) => {
      const invalidOverride = join(fixtureDir, "missing-codex");

      const result = runCli(["doctor", "--json"], undefined, {
        CDX_CHORES_CODEX_PATH: invalidOverride,
        CODEX_API_KEY: "test-key",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const payload = JSON.parse(result.stdout);
      expect(payload.queryCodex.configuredSupport).toBe(false);
      expect(payload.queryCodex.readyToDraft).toBe(false);
      expect(payload.queryCodex.authSessionAvailable).toBe(true);
      expect(payload.queryCodex.detail).toContain("Codex override path is not executable");
      expect(payload.queryCodex.detail).toContain(invalidOverride);
      expect(payload.capabilities["data.query.codex"]).toBe(false);
    });
  });

  test("inspectCommand parses WeasyPrint version labels", async () => {
    const versions = [
      ["WeasyPrint version 67.0\n", "67.0"],
      ["WeasyPrint version: 67.0\n", "67.0"],
      ["System: test\nVersion: 67.0\n", "67.0"],
    ] as const;

    for (const [stdout, expectedVersion] of versions) {
      const status = await inspectCommand("weasyprint", "darwin", async () => ok(stdout));
      expect(status).toMatchObject({
        available: true,
        version: expectedVersion,
      });
    }
  });
});

describe("cli action modules: markdown/video failure paths", () => {
  test("actionMdToDocx rejects missing input before dependency execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.md");

      await expectCliError(() => actionMdToDocx(runtime, { input: toRepoRelativePath(missing) }), {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
        messageIncludes: "Input file not found:",
      });

      expectNoOutput();
    });
  });

  test("actionVideoConvert rejects missing input before ffmpeg execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.mp4");

      await expectCliError(
        () =>
          actionVideoConvert(runtime, {
            input: toRepoRelativePath(missing),
            output: toRepoRelativePath(join(fixtureDir, "out.mov")),
          }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expectNoOutput();
    });
  });

  test("actionVideoGif rejects missing input before ffmpeg execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.mp4");

      await expectCliError(
        () => actionVideoGif(runtime, { input: toRepoRelativePath(missing), overwrite: true }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize validates width before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            width: 0,
            height: 320,
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Width must be a positive number." },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize validates scale before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            scale: 0,
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Scale must be a positive number." },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize validates height before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            width: 320,
            height: 0,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Height must be a positive number.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize requires a complete resize mode before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Provide --scale or both --width and --height.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize rejects mixing scale with explicit dimensions", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            scale: 0.5,
            width: 640,
            height: 360,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Use either --scale or both --width and --height, not both.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize requires width and height together", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            width: 640,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Width and height must be provided together.",
        },
      );

      expectNoOutput();
    });
  });
});
