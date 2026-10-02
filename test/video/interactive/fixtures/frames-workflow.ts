import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
        `${name}: ${message}: unexpected ${next}. ${errors}`,
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
    for (const prepared of reviews) {
      assert(
        text.includes(
          `Mode: ${{ single: "One frame", set: "Frame set", sequence: "Sequence" }[prepared.options.mode]}`,
        ),
      );
      assert(
        text.includes(prepared.destination.kind === "file" ? "Output file:" : "Output folder:"),
      );
    }
    assert(!text.includes("Available space:"));
    assert(!text.includes("Available-space check"));
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
        assert.equal(options.durationIsEstimate, true);
        const request = { kind: "time" as const, timeMs: { numerator: 80n, denominator: 1n } };
        const identity = await options.resolve(request, new AbortController().signal);
        return { request, resolved: identity, glyphs: "unicode", selection: "custom" };
      },
      settings: async (_io, _pathContext, _mode, _encoders, _initial, namingContext) => {
        assert.equal(namingContext?.source, join(path, "source.bin"));
        assert.equal(namingContext?.selections?.[0]?.identity.frameNumber, 3);
        return ++settingCalls === 1
          ? settings("png", join(path, "approved.png"))
          : settings("webp", join(path, settingCalls === 2 ? "approved.png" : "approved.webp"));
      },
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
  const single = await run("nested-single", ["single", "first", "export"], ({ path }) => ({
    settings: async () => settings("png", "example/Literal Image.PnG"),
    onReview: () => assert.equal(existsSync(join(path, "example")), false),
  }));
  assert.equal(existsSync(join(single.path, "example", "Literal Image.PnG")), true);
  assert.match(single.text, /Naming: Explicit filename/);
  for (const mode of ["single", "set", "sequence"] as const) {
    const cancelledNested = await run(
      "nested-cancel-" + mode,
      [mode, ...(mode === "single" ? ["first"] : []), "cancel"],
      ({ path }) => ({
        settings: async () =>
          settings(
            "png",
            mode === "single" ? "example/image.png" : "example/images",
            mode === "single" ? "file" : "folder",
          ),
        onReview: () => assert.equal(existsSync(join(path, "example")), false),
      }),
    );
    assert.deepEqual(await readdir(cancelledNested.path), ["source.bin"]);
  }
  const sequence = await run("sequence", ["sequence", "export"], () => ({
    settings: async () =>
      settings("webp", "images", "folder", "{stem}-{frame}-{serial_start_3_##}"),
  }));
  assert.match(sequence.text, /Source \{frame\} numbers will be resolved/);
  assert.match(sequence.text, /Wrote 8 image/);
  assert.equal((await readdir(join(sequence.path, "images"))).length, 8);
  process.env.CDX_FRAME_SEQUENCE = JSON.stringify({
    starts: [0, 40, 80, 120],
    durationEstimate: 160,
  });
  const oneImageSequence = await run("one-image-sequence", ["sequence", "export"], ({ path }) => ({
    cadence: async () => ({ interval: "1s" }),
    settings: async () => settings("png", "example/images", "folder", "{stem}-{serial}"),
    onReview: (prepared) => {
      assert.equal(prepared.destination.kind, "folder");
      assert.equal(prepared.estimatedCount, 1n);
      assert.equal(existsSync(join(path, "example")), false);
    },
  }));
  assert.deepEqual(await readdir(join(oneImageSequence.path, "example", "images")), [
    "source-000001.png",
  ]);
  delete process.env.CDX_FRAME_SEQUENCE;
  process.env.CDX_FRAME_MODE = "repeat";
  const repeated = await run("fixed-set", ["set", "export"], ({ path }) => ({
    settings: async () => settings("png", "example/images", "folder", "{stem}-{selection}"),
    onReview: () => assert.equal(existsSync(join(path, "example")), false),
  }));
  assert.match(repeated.text, /retains 2 repeated selection/);
  assert.deepEqual((await readdir(join(repeated.path, "example", "images"))).sort(), [
    "source-first.png",
    "source-last.png",
    "source-middle.png",
  ]);
  process.env.CDX_FRAME_MODE = "normal";
  for (const mode of ["single", "set", "sequence"] as const) {
    const conflicts = await run(
      "path-kind-" + mode,
      [mode, ...(mode === "single" ? ["first"] : []), "cancel"],
      ({ path }) => {
        const target = join(path, mode === "single" ? "blocked.png" : "blocked");
        if (mode === "single") mkdirSync(target);
        else writeFileSync(target, "existing file");
        return {
          settings: async () => settings("png", target, mode === "single" ? "file" : "folder"),
        };
      },
    );
    assert.equal(conflicts.reviews.length, 0);
    assert.match(conflicts.errors, /destination must be an ordinary/);
    assert.equal((await readdir(conflicts.path)).length, 2);
  }
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
      nestedDestinations: true,
      pathKindConflicts: true,
      sequence: true,
      oneImageSequence: true,
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
