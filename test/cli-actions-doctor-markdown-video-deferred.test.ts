import { describe, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  actionDeferred,
  actionDoctor,
  actionMdToDocx,
  actionVideoConvert,
  actionVideoGif,
  actionVideoResize,
} from "../src/cli/actions";
import { CliError } from "../src/cli/errors";
import { createCapturedRuntime, createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";

async function expectCliError(
  run: () => Promise<unknown>,
  expected: { code: string; exitCode?: number; messageIncludes?: string },
): Promise<CliError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    const cliError = error as CliError;
    expect(cliError.code).toBe(expected.code);
    if (expected.exitCode !== undefined) {
      expect(cliError.exitCode).toBe(expected.exitCode);
    }
    if (expected.messageIncludes) {
      expect(cliError.message).toContain(expected.messageIncludes);
    }
    return cliError;
  }

  throw new Error("Expected CliError but action resolved successfully");
}

describe("cli action modules: doctor", () => {
  test("actionDoctor emits machine-readable JSON payload", async () => {
    const { runtime, stdout, stderr } = createCapturedRuntime();

    await actionDoctor(runtime, { json: true });

    expect(stderr.text).toBe("");
    const payload = JSON.parse(stdout.text);
    expect(typeof payload.generatedAt).toBe("string");
    expect(payload.platform).toBe(process.platform);
    expect(typeof payload.nodeVersion).toBe("string");
    expect(payload.tools).toHaveProperty("pandoc");
    expect(payload.tools).toHaveProperty("ffmpeg");
    expect(typeof payload.tools.pandoc.available).toBe("boolean");
    expect(typeof payload.tools.ffmpeg.available).toBe("boolean");
    expect(Object.hasOwn(payload.capabilities, "md.to-docx")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "video.gif")).toBe(true);
  });

  test("actionDoctor emits human-readable text report", async () => {
    const { runtime, stdout, stderr } = createCapturedRuntime();

    await actionDoctor(runtime);

    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("cdx-chores doctor");
    expect(stdout.text).toContain("Platform:");
    expect(stdout.text).toContain("Node.js:");
    expect(stdout.text).toContain("Capabilities:");
    expect(stdout.text).toContain("md.to-docx");
    expect(stdout.text).toContain("video.gif");
  });
});

describe("cli action modules: deferred", () => {
  test("actionDeferred throws a deferred feature error", async () => {
    const { runtime, stdout, stderr } = createCapturedRuntime();

    await expectCliError(
      () => actionDeferred(runtime, "pdf merge"),
      {
        code: "DEFERRED_FEATURE",
        exitCode: 2,
        messageIncludes: "pdf merge is not implemented",
      },
    );

    expect(stdout.text).toBe("");
    expect(stderr.text).toBe("");
  });
});

describe("cli action modules: markdown/video failure paths", () => {
  test("actionMdToDocx rejects missing input before dependency execution", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const missing = join(fixtureDir, "missing.md");

      await expectCliError(
        () => actionMdToDocx(runtime, { input: toRepoRelativePath(missing) }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionVideoConvert rejects missing input before ffmpeg execution", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const missing = join(fixtureDir, "missing.mp4");

      await expectCliError(
        () => actionVideoConvert(runtime, {
          input: toRepoRelativePath(missing),
          output: toRepoRelativePath(join(fixtureDir, "out.mov")),
        }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionVideoGif rejects missing input before ffmpeg execution", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const missing = join(fixtureDir, "missing.mp4");

      await expectCliError(
        () => actionVideoGif(runtime, { input: toRepoRelativePath(missing), overwrite: true }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionVideoResize validates width before file checks", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () => actionVideoResize(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
          width: 0,
          height: 320,
        }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Width must be a positive number." },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionVideoResize validates height before file checks", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () => actionVideoResize(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
          width: 320,
          height: 0,
        }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Height must be a positive number." },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
