import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { actionVideoGif } from "../src/cli/actions/video";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";

interface FakeFfmpegRecord {
  call: number;
  args: string[];
  kind: "version" | "exec";
  outputPath?: string;
  paletteInputPath?: string;
  paletteExistsAtRender?: boolean;
}

const ORIGINAL_PATH = process.env.PATH ?? "";
const ORIGINAL_LOG = process.env.CDX_TEST_FFMPEG_LOG;
const ORIGINAL_STATE = process.env.CDX_TEST_FFMPEG_STATE;
const ORIGINAL_FAIL_ON = process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL;

async function createFakeFfmpegEnvironment(fixtureDir: string): Promise<{
  inputPath: string;
  outputPath: string;
  logPath: string;
  statePath: string;
}> {
  const binDir = join(fixtureDir, "bin");
  const inputPath = join(fixtureDir, "input.mp4");
  const outputPath = join(fixtureDir, "output.gif");
  const scriptPath = join(binDir, "ffmpeg");
  const logPath = join(fixtureDir, "ffmpeg-log.jsonl");
  const statePath = join(fixtureDir, "ffmpeg-state.json");

  await mkdir(binDir, { recursive: true });
  await writeFile(inputPath, "fake-video", "utf8");
  await writeFile(
    scriptPath,
    `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const logPath = process.env.CDX_TEST_FFMPEG_LOG;
const statePath = process.env.CDX_TEST_FFMPEG_STATE;
const failOnCall = Number(process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL || "0");

let state = { calls: 0 };
if (statePath && fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, "utf8"));
}
state.calls += 1;
if (statePath) {
  fs.writeFileSync(statePath, JSON.stringify(state), "utf8");
}

const outputPath = args.at(-1);
const paletteInputPath = args.find((value) => value.endsWith(".png"));
const record = {
  call: state.calls,
  args,
  kind: args[0] === "-version" ? "version" : "exec",
  outputPath,
  paletteInputPath,
  paletteExistsAtRender:
    paletteInputPath && args.includes("-lavfi") ? fs.existsSync(paletteInputPath) : undefined,
};

if (record.kind === "version") {
  if (logPath) {
    fs.appendFileSync(logPath, JSON.stringify(record) + "\\n", "utf8");
  }
  process.stdout.write("ffmpeg version fake-test\\n");
  process.exit(0);
}

if (outputPath && outputPath.endsWith(".png")) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, "palette", "utf8");
}
if (outputPath && outputPath.endsWith(".gif")) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, "gif", "utf8");
}

if (logPath) {
  fs.appendFileSync(logPath, JSON.stringify(record) + "\\n", "utf8");
}

if (failOnCall === state.calls) {
  process.stderr.write(state.calls === 2 ? "palettegen failed\\n" : "paletteuse failed\\n");
  process.exit(1);
}
process.exit(0);
`,
    "utf8",
  );
  await chmod(scriptPath, 0o755);

  process.env.PATH = `${binDir}:${ORIGINAL_PATH}`;
  process.env.CDX_TEST_FFMPEG_LOG = logPath;
  process.env.CDX_TEST_FFMPEG_STATE = statePath;
  delete process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL;

  return { inputPath, outputPath, logPath, statePath };
}

async function readFakeFfmpegLog(logPath: string): Promise<FakeFfmpegRecord[]> {
  const raw = await readFile(logPath, "utf8");
  return raw
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FakeFfmpegRecord);
}

function getExecRecords(records: FakeFfmpegRecord[]): FakeFfmpegRecord[] {
  return records.filter((record) => record.kind === "exec");
}

afterEach(() => {
  process.env.PATH = ORIGINAL_PATH;

  if (ORIGINAL_LOG === undefined) {
    delete process.env.CDX_TEST_FFMPEG_LOG;
  } else {
    process.env.CDX_TEST_FFMPEG_LOG = ORIGINAL_LOG;
  }

  if (ORIGINAL_STATE === undefined) {
    delete process.env.CDX_TEST_FFMPEG_STATE;
  } else {
    process.env.CDX_TEST_FFMPEG_STATE = ORIGINAL_STATE;
  }

  if (ORIGINAL_FAIL_ON === undefined) {
    delete process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL;
  } else {
    process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL = ORIGINAL_FAIL_ON;
  }
});

describe("actionVideoGif", () => {
  test("runs compressed mode as a one-pass ffmpeg invocation with phase messages", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionVideoGif(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        mode: "compressed",
        width: 320,
        fps: 12,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);

      expectNoStderr();
      expect(execRecords).toHaveLength(1);
      expect(execRecords[0]?.args).toEqual([
        "-n",
        "-i",
        inputPath,
        "-vf",
        "fps=12,scale=320:-1:flags=lanczos",
        outputPath,
      ]);
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: compressed",
        "Rendering GIF...",
        `Wrote GIF: ${toRepoRelativePath(outputPath)}`,
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("defaults to compressed mode when mode is omitted", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionVideoGif(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        width: 320,
        fps: 12,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);

      expectNoStderr();
      expect(execRecords).toHaveLength(1);
      expect(execRecords[0]?.args).toEqual([
        "-n",
        "-i",
        inputPath,
        "-vf",
        "fps=12,scale=320:-1:flags=lanczos",
        outputPath,
      ]);
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: compressed",
        "Rendering GIF...",
        `Wrote GIF: ${toRepoRelativePath(outputPath)}`,
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("runs quality mode with the default video profile and cleans up the palette artifact", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionVideoGif(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        mode: "quality",
        width: 320,
        fps: 12,
        overwrite: true,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);
      const palettePath = execRecords[0]?.outputPath;

      expectNoStderr();
      expect(execRecords).toHaveLength(2);
      expect(palettePath?.startsWith(resolve(tmpdir())) || palettePath?.startsWith(tmpdir())).toBe(true);
      expect(basename(String(palettePath))).toMatch(
        /^cdx-chores-video-gif-output-palette-[0-9a-f]{6}\.png$/,
      );
      expect(execRecords[0]?.args).toEqual([
        "-y",
        "-i",
        inputPath,
        "-vf",
        "fps=12,scale=320:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=full:reserve_transparent=0",
        "-frames:v",
        "1",
        String(palettePath),
      ]);
      expect(execRecords[1]?.args).toEqual([
        "-y",
        "-i",
        inputPath,
        "-i",
        String(palettePath),
        "-lavfi",
        "fps=12,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a",
        outputPath,
      ]);
      expect(execRecords[1]?.paletteExistsAtRender).toBe(true);
      await expect(readFile(String(palettePath), "utf8")).rejects.toThrow();
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: quality",
        "GIF profile: video",
        "Generating GIF palette...",
        "Rendering GIF from palette...",
        `Wrote GIF: ${toRepoRelativePath(outputPath)}`,
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("cleans up the palette artifact when quality-mode rendering fails after palette generation", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL = "4";

      await expect(
        actionVideoGif(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          mode: "quality",
          width: 320,
          fps: 12,
        }),
      ).rejects.toMatchObject({
        code: "PROCESS_FAILED",
        exitCode: 1,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);
      const palettePath = execRecords[0]?.outputPath;

      expectNoStderr();
      expect(execRecords[1]?.args).toEqual([
        "-n",
        "-i",
        inputPath,
        "-i",
        String(palettePath),
        "-lavfi",
        "fps=12,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a",
        outputPath,
      ]);
      expect(execRecords[1]?.paletteExistsAtRender).toBe(true);
      await expect(readFile(String(palettePath), "utf8")).rejects.toThrow();
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: quality",
        "GIF profile: video",
        "Generating GIF palette...",
        "Rendering GIF from palette...",
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("cleans up the palette artifact when quality-mode palette generation fails immediately", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      process.env.CDX_TEST_FFMPEG_FAIL_ON_CALL = "2";

      await expect(
        actionVideoGif(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          mode: "quality",
          width: 320,
          fps: 12,
        }),
      ).rejects.toMatchObject({
        code: "PROCESS_FAILED",
        exitCode: 1,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);
      const palettePath = execRecords[0]?.outputPath;

      expectNoStderr();
      expect(execRecords).toHaveLength(1);
      await expect(readFile(String(palettePath), "utf8")).rejects.toThrow();
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: quality",
        "GIF profile: video",
        "Generating GIF palette...",
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("infers quality mode when gifProfile is provided without mode", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionVideoGif(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        gifProfile: "screen",
        width: 320,
        fps: 12,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);
      const palettePath = execRecords[0]?.outputPath;

      expectNoStderr();
      expect(execRecords).toHaveLength(2);
      expect(execRecords[0]?.args).toEqual([
        "-y",
        "-i",
        inputPath,
        "-vf",
        "fps=12,scale=320:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=diff:reserve_transparent=0",
        "-frames:v",
        "1",
        String(palettePath),
      ]);
      expect(execRecords[1]?.args).toEqual([
        "-n",
        "-i",
        inputPath,
        "-i",
        String(palettePath),
        "-lavfi",
        "fps=12,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle",
        outputPath,
      ]);
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: quality",
        "GIF profile: screen",
        "Generating GIF palette...",
        "Rendering GIF from palette...",
        `Wrote GIF: ${toRepoRelativePath(outputPath)}`,
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("uses the motion profile recipe when explicitly requested", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath, logPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionVideoGif(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        mode: "quality",
        gifProfile: "motion",
        width: 320,
        fps: 12,
      });

      const records = await readFakeFfmpegLog(logPath);
      const execRecords = getExecRecords(records);
      const palettePath = execRecords[0]?.outputPath;

      expectNoStderr();
      expect(execRecords[0]?.args).toEqual([
        "-y",
        "-i",
        inputPath,
        "-vf",
        "fps=12,scale=320:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=diff:reserve_transparent=0",
        "-frames:v",
        "1",
        String(palettePath),
      ]);
      expect(execRecords[1]?.args).toEqual([
        "-n",
        "-i",
        inputPath,
        "-i",
        String(palettePath),
        "-lavfi",
        "fps=12,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
        outputPath,
      ]);
      expect(stdout.text.trim().split("\n")).toEqual([
        "Starting GIF conversion...",
        "Mode: quality",
        "GIF profile: motion",
        "Generating GIF palette...",
        "Rendering GIF from palette...",
        `Wrote GIF: ${toRepoRelativePath(outputPath)}`,
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rejects gifProfile with explicit compressed mode", async () => {
    const fixtureDir = await createTempFixtureDir("video-gif-action");
    try {
      const { inputPath, outputPath } = await createFakeFfmpegEnvironment(fixtureDir);
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expect(actionVideoGif(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        mode: "compressed",
        gifProfile: "video",
      })).rejects.toMatchObject({
        code: "INVALID_INPUT",
        exitCode: 2,
      });

      expectNoOutput();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
