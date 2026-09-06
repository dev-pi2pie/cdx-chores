import { describe, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionVideoConvert, actionVideoGif, actionVideoResize } from "../../../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("video action preconditions", () => {
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
