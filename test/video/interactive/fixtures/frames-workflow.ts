import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import {
  handleVideoFramesInteractive,
  type FrameWorkflowPrompts,
} from "../../../../src/cli/interactive/video-frames/workflow";
import type { FrameImageSettings } from "../../../../src/cli/interactive/video-frames/settings";
import type { PreparedVideoFrames } from "../../../../src/cli/actions/video-frames";
import { CliError } from "../../../../src/cli/errors";
import type { CliRuntime } from "../../../../src/cli/types";
import type { InteractivePathPromptContext } from "../../../../src/cli/interactive/shared";
const [root, tool] = process.argv.slice(2) as [string, string];
async function main() {
  const bin = join(root, "bin");
  await mkdir(bin);
  for (const name of ["ffmpeg", "ffprobe"]) {
    await writeFile(join(bin, name), `#!${process.execPath}\n${await readFile(tool, "utf8")}`);
    await chmod(join(bin, name), 0o700);
  }
  process.env.PATH = bin;
  const run = async (
    name: string,
    decisions: string[],
    setup: (context: {
      path: string;
      input: PassThrough;
      reviews: PreparedVideoFrames[];
    }) => Partial<FrameWorkflowPrompts>,
  ) => {
    const path = join(root, name);
    await mkdir(path);
    await writeFile(join(path, "source.bin"), "original source");
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      isRaw: false,
      setRawMode(value: boolean) {
        this.isRaw = value;
        return this;
      },
    });
    const output = Object.assign(new PassThrough(), { isTTY: true, columns: 100, rows: 32 });
    let text = "";
    output.on("data", (chunk) => {
      text += chunk;
    });
    const errorOutput = new PassThrough();
    let errors = "";
    errorOutput.on("data", (chunk) => {
      errors += chunk;
    });
    const runtime: CliRuntime = {
      cwd: path,
      platform: process.platform,
      now: () => new Date(),
      colorEnabled: false,
      stdin: input as unknown as NodeJS.ReadStream,
      stdout: output,
      stderr: errorOutput,
      displayPathStyle: "relative",
    };
    const context: InteractivePathPromptContext = {
      cwd: path,
      stdin: runtime.stdin,
      stdout: output,
      runtimeConfig: {
        mode: "simple",
        autocomplete: { enabled: false, minChars: 1, maxSuggestions: 10, includeHidden: false },
      },
    };
    const reviews: PreparedVideoFrames[] = [];
    const used: string[] = [];
    const choose: FrameWorkflowPrompts["choose"] = async (_io, message, choices) => {
      used.push(message);
      const next = decisions.shift();
      assert.ok(
        choices.some((choice) => choice.value === next),
        `${message}: unexpected ${next}`,
      );
      return next as never;
    };
    const overrides = setup({ path, input, reviews });
    await handleVideoFramesInteractive(runtime, context, {
      choose,
      path: async () => "source.bin",
      preset: async () => "first-middle-last",
      cadence: async () => ({ fps: "50" }),
      onReview: (prepared) => {
        reviews.push(prepared);
        overrides.onReview?.(prepared);
      },
      ...overrides,
      // Keep observations while allowing the test's synchronous boundary assertion.
      ...(overrides.onReview
        ? {
            onReview: (prepared: PreparedVideoFrames) => {
              reviews.push(prepared);
              overrides.onReview!(prepared);
            },
          }
        : {}),
    });
    assert.equal(decisions.length, 0, name);
    assert.equal(input.isRaw, false);
    assert.equal(input.listenerCount("keypress"), 0);
    assert.equal(process.listenerCount("SIGINT"), 0);
    return { path, text, errors, reviews, used };
  };
  const settings = (
    format: "png" | "jpg" | "webp",
    path: string,
    kind: "file" | "folder" = "file",
    template?: string,
  ): FrameImageSettings => ({
    format,
    quality: "full",
    scale: 1,
    destination: { kind, path },
    naming: template ? { template } : undefined,
    overwrite: false,
  });
  let settingCalls = 0;
  const changed = await run(
    "changed-options",
    ["single", "custom", "settings", "settings", "export"],
    ({ path }) => ({
      picker: async (options) => {
        const request = { kind: "time" as const, timeMs: { numerator: 80n, denominator: 1n } };
        const identity = await options.resolve(request, new AbortController().signal);
        return { request, resolved: identity, glyphs: "unicode", selection: "custom" };
      },
      settings: async () =>
        ++settingCalls === 1
          ? settings("png", join(path, "approved.png"))
          : settings("webp", join(path, settingCalls === 2 ? "approved.png" : "approved.webp")),
      onReview: (prepared) => {
        assert.equal(prepared.selections[0]!.identity.frameNumber, 3);
        assert.equal(prepared.destination.nonempty, false);
      },
    }),
  );
  assert.equal(changed.reviews.length, 2);
  assert.equal(
    changed.reviews[0]!.selections[0]!.identity,
    changed.reviews[1]!.selections[0]!.identity,
  );
  assert.match(changed.text, /Requested: Time 00:00:00.080/);
  assert.match(changed.errors, /extension must match/);
  assert.equal((await readdir(changed.path)).includes("approved.png"), false);
  assert.equal((await readdir(changed.path)).includes("approved.webp"), true);
  const cancelled = await run("review-cancel", ["single", "first", "cancel"], () => ({
    settings: async () => ({ ...settings("png", "unused.png"), destination: { kind: "default" } }),
  }));
  assert.equal((await readdir(cancelled.path)).includes("source-frame.png"), false);
  const sequence = await run("sequence", ["sequence", "export"], () => ({
    settings: async () =>
      settings("webp", "images", "folder", "{stem}-{frame}-{serial_start_3_##}"),
  }));
  assert.match(sequence.text, /Source \{frame\} numbers will be resolved/);
  assert.match(sequence.text, /Wrote 8 image/);
  assert.equal((await readdir(join(sequence.path, "images"))).length, 8);
  process.env.CDX_FRAME_MODE = "repeat";
  const repeated = await run("fixed-set", ["set", "export"], () => ({
    settings: async () => settings("png", "images", "folder", "{stem}-{selection}"),
  }));
  assert.match(repeated.text, /retains 2 repeated selection/);
  assert.deepEqual((await readdir(join(repeated.path, "images"))).sort(), [
    "source-first.png",
    "source-last.png",
    "source-middle.png",
  ]);
  process.env.CDX_FRAME_MODE = "normal";
  let selectedSource = 0;
  const sourceChanged = await run("source-change", ["single", "first", "export"], ({ path }) => ({
    path: async () => (++selectedSource === 1 ? "source.bin" : undefined),
    settings: async () => settings("png", "unchanged.png"),
    onReview: () => {
      require("node:fs").writeFileSync(join(path, "source.bin"), "changed source content");
    },
  }));
  assert.equal(selectedSource, 2);
  assert.equal((await readdir(sourceChanged.path)).includes("unchanged.png"), false);
  let failureSettings = false;
  const fatal = new CliError("Child closure unconfirmed", {
    code: "PROCESS_STOP_FAILED",
    exitCode: 2,
  });
  await assert.rejects(
    run("fatal", ["single", "custom"], () => ({
      picker: async () => {
        throw fatal;
      },
      settings: async () => {
        failureSettings = true;
        return null;
      },
    })),
    (error) => error === fatal,
  );
  assert.equal(failureSettings, false);
  assert.equal(process.listenerCount("SIGINT"), 0);
  console.log(
    JSON.stringify({
      changedSettings: true,
      exactIdentity: true,
      extension: true,
      reviewCancel: true,
      sequence: true,
      repeatedSet: true,
      sourceChange: true,
      fatalStop: true,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
