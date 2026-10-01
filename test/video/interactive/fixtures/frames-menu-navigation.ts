import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { chooseFrameOption } from "../../../../src/cli/interactive/video-frames/simple-prompts";
import {
  promptFrameCadence,
  promptFrameImageSettings,
} from "../../../../src/cli/interactive/video-frames/settings";
import { promptFrameNaming } from "../../../../src/cli/interactive/video-frames/naming";
import { promptFramePicker } from "../../../../src/cli/interactive/video-frames/picker";
import { exact } from "../../../../src/cli/video-frames/exact";
import { resolvePathPromptRuntimeConfig } from "../../../../src/cli/prompts/path-config";

class Input extends PassThrough {
  isTTY = true;
  isRaw = false;
  setRawMode(raw: boolean): this {
    this.isRaw = raw;
    return this;
  }
}
class Output extends PassThrough {
  isTTY = true;
  rows = 18;
  columns = 60;
  text = "";
  constructor() {
    super();
    this.end = (() => this) as typeof this.end;
    this.on("data", (value) => {
      this.text += stripVTControlCharacters(String(value));
    });
  }
}
const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};
function streams() {
  const actualInput = new Input(),
    actualOutput = new Output();
  const io = {
    input: actualInput as unknown as NodeJS.ReadStream,
    output: actualOutput as unknown as NodeJS.WriteStream,
  };
  const wait = async (text: string, start = 0) => {
    const deadline = Date.now() + 1_000;
    while (!actualOutput.text.slice(start).includes(text)) {
      if (Date.now() > deadline)
        throw new Error("Prompt did not reach " + text + ": " + actualOutput.text.slice(start));
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await flush();
  };
  const step = async (keys: string, text: string) => {
    const start = actualOutput.text.length;
    actualInput.write(keys);
    await wait(text, start);
  };
  const clean = () => {
    assert.equal(actualInput.isRaw, false);
    assert.equal(actualInput.listenerCount("keypress"), 0);
    assert.equal(actualOutput.listenerCount("resize"), 0);
  };
  return { io, actualInput, actualOutput, wait, step, clean };
}
const up = "\x1b[A",
  down = "\x1b[B",
  escape = "\x1b",
  enter = "\r";
const encoders = {
  png: "supported",
  jpg: "supported",
  webp: "supported",
  webpEncoder: "supported",
  webpBgra: "supported",
  webpLossless: "supported",
} as const;

async function boundaries(): Promise<void> {
  const choices = Array.from({ length: 9 }, (_, index) => ({
    name: "Choice " + (index + 1),
    value: "v" + index,
  }));
  choices.push({ name: "Back", value: "back" });
  for (const [defaultValue, keys, expected] of [
    ["v0", up, "v0"],
    ["back", down, "back"],
  ] as const) {
    const s = streams();
    const prompt = chooseFrameOption(s.io, "Synthetic choices", choices, "back", defaultValue);
    await s.wait("Synthetic choices");
    s.actualInput.write(keys);
    await flush();
    if (defaultValue === "back") {
      const page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("Synthetic choices"));
      assert(!page.includes("Choice 1\n"), "Bottom pagination must not wrap to the beginning");
      assert(page.indexOf("Choice 9") < page.indexOf("Back"));
    }
    s.actualInput.write(enter);
    assert.equal(await prompt, expected);
    s.clean();
  }
  const s = streams();
  const prompt = chooseFrameOption(
    s.io,
    "Encoder choices",
    [
      { name: "PNG", value: "png", disabled: "Unavailable" },
      { name: "JPEG", value: "jpg" },
      { name: "Back", value: "back" },
    ],
    "back",
    "png",
  );
  await s.wait("Encoder choices");
  await s.step(up + enter, "This option is disabled");
  s.actualInput.write(down + enter);
  assert.equal(await prompt, "jpg");
  s.clean();
}

async function cadence(): Promise<void> {
  const s = streams();
  const prompt = promptFrameCadence(s.io, exact(5_100n), { interval: "1s" });
  await s.wait("Sequence cadence");
  await s.step(enter, "Sampling interval");
  // Short labels keep the current estimate out of the ordered list itself.
  assert(s.actualOutput.text.includes("Every 1s"));
  assert(!s.actualOutput.text.includes("Every 1s -"));
  await s.step(down.repeat(6) + enter, "Interval (positive");
  s.actualInput.write("\x7f\x7f7s");
  await flush();
  await s.step(escape, "Sampling interval");
  // Custom Escape returns only to presets, retaining both custom selection and draft.
  await s.step(enter, "Interval (positive");
  await s.step(escape, "Sampling interval");
  await s.step(down + enter, "Sequence cadence");
  await s.step(enter, "Sampling interval");
  await s.step(enter, "Interval (positive");
  s.actualInput.write("\x7f".repeat(2) + "9s" + enter);
  assert.deepEqual(await prompt, { interval: "9s" });
  s.clean();
  const next = promptFrameCadence(s.io, undefined, { fps: "23.976" });
  await s.wait("Sequence cadence", s.actualOutput.text.lastIndexOf("Sequence cadence"));
  await flush();
  await s.step(enter, "Images per second");
  await s.step(enter, "FPS (positive");
  s.actualInput.write(enter);
  assert.deepEqual(await next, { fps: "23.976" });
  s.clean();
}

async function resizedDescriptions(): Promise<void> {
  const s = streams();
  s.actualOutput.rows = 8;
  s.actualOutput.columns = 28;
  const description = "Synthetic destination: " + "long-path/".repeat(20) + "image.png";
  const prompt = chooseFrameOption(
    s.io,
    "Tall choices",
    [
      { name: "Current destination", description, value: "current" },
      { name: "Other destination", value: "other" },
      { name: "Back", value: "back" },
    ],
    "back",
  );
  await s.wait("Tall choices");
  const narrow = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Tall choices"));
  assert(narrow.includes("Up/Down | Enter | Esc Back"));
  assert(narrow.includes("..."));
  assert(
    narrow.trimEnd().split("\n").length <= 8,
    "Controls fit under a clipped narrow description",
  );
  s.actualOutput.rows = 32;
  s.actualOutput.columns = 100;
  s.actualOutput.emit("resize");
  await flush();
  // Exercise a key after resize too, then return to the same retained selection.
  s.actualInput.write(down + up);
  await flush();
  const wide = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Tall choices"));
  assert(wide.includes("image.png"));
  s.actualInput.write(enter);
  assert.equal(await prompt, "current");
  s.clean();
}

async function directDrafts(): Promise<void> {
  for (const kind of ["frame", "time"] as const) {
    const s = streams();
    let resolutions = 0;
    const prompt = promptFramePicker({
      ...s.io,
      simple: true,
      durationMs: 3_000,
      resolve: async (request) => {
        resolutions++;
        assert.equal(request.kind, kind);
        if (request.kind === "frame") assert.equal(request.frameNumber, 12);
        if (request.kind === "time") assert.deepEqual(request.timeMs, exact(1_234n));
        return { frameNumber: 12, startMs: 1_200 };
      },
    });
    await s.wait("Frame number");
    const label = kind === "frame" ? "Source frame (1-based" : "Time HH:MM:SS";
    await s.step((kind === "time" ? down : "") + enter, label);
    const draft = kind === "frame" ? "12" : "00:00:01.234";
    s.actualInput.write(draft);
    await flush();
    await s.step(escape, "Frame number");
    assert.equal(resolutions, 0, "Backing out of an editor never resolves a frame");
    await s.step(enter, label);
    assert(s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf(label)).includes(draft));
    s.actualInput.write(enter);
    assert.equal((await prompt)?.resolved.frameNumber, 12);
    assert.equal(resolutions, 1);
    s.clean();
  }
}

async function naming(simple: boolean): Promise<void> {
  const s = streams();
  const prompt = promptFrameNaming({ ...s.io, simple }, "sequence");
  await s.wait("Image naming");
  await s.step(down + enter, "Filename template");
  s.actualInput.write("clip-{serial}");
  await flush();
  await s.step(escape, "Image naming");
  await s.step(enter, "Filename template");
  // Advanced and simple editors must restore their exact escaped drafts.
  assert(
    s.actualOutput.text
      .slice(s.actualOutput.text.lastIndexOf("Filename template"))
      .includes("clip-{serial}"),
  );
  await s.step(enter, "Serial start");
  await s.step("7" + enter, "Minimum serial width");
  s.actualInput.write("3");
  await flush();
  await s.step(escape, "Serial start");
  await s.step("\x7f9" + enter, "Minimum serial width");
  s.actualInput.write(enter);
  assert.deepEqual(await prompt, { template: "clip-{serial}", serialStart: 9, serialWidth: 3 });
  s.clean();
}

async function settings(simple: boolean): Promise<void> {
  const s = streams();
  const prompt = promptFrameImageSettings(
    { ...s.io, simple },
    {
      cwd: process.cwd(),
      stdin: s.io.input,
      stdout: s.io.output,
      runtimeConfig: resolvePathPromptRuntimeConfig({}),
    },
    "single",
    encoders,
  );
  await s.wait("Image format");
  await s.step(down + enter, "Image quality");
  await s.step(down + enter, "Output scale");
  await s.step(escape, "Image quality");
  await s.step(enter, "Output scale");
  await s.step(down.repeat(5) + enter, "Scale from 0.1 to 1");
  s.actualInput.write("0.37");
  await flush();
  await s.step(escape, "Output scale");
  await s.step(enter, "Scale from 0.1 to 1");
  await s.step(enter, "Image destination");
  await s.step(down.repeat(2) + enter, "Output image file (.jpg)");
  s.actualInput.write("synthetic-image.jp");
  await flush();
  await s.step(escape, "Image destination");
  await s.step(enter, "Output image file (.jpg)");
  assert(
    s.actualOutput.text
      .slice(s.actualOutput.text.lastIndexOf("Output image file"))
      .includes("synthetic-image.jp"),
  );
  await s.step("g" + enter, "Existing output images");
  await s.step(escape, "Output image file (.jpg)");
  await s.step(enter, "Existing output images");
  s.actualInput.write(enter);
  assert.deepEqual(await prompt, {
    format: "jpg",
    quality: "high",
    scale: 0.37,
    destination: { kind: "file", path: "synthetic-image.jpg" },
    overwrite: false,
  });
  s.clean();
}

const scenario = process.argv[2];
const guard = setTimeout(() => {
  process.stderr.write("Frame menu navigation fixture timed out: " + scenario + "\n");
  process.exit(1);
}, 10_000);
try {
  if (scenario === "boundaries") await boundaries();
  else if (scenario === "resize") await resizedDescriptions();
  else if (scenario === "cadence") await cadence();
  else if (scenario === "direct") await directDrafts();
  else if (scenario === "naming") {
    await naming(false);
    await naming(true);
  } else if (scenario === "settings") {
    await settings(false);
    await settings(true);
  } else throw new Error("Unknown menu navigation scenario");
  process.stdout.write(JSON.stringify({ scenario, passed: true }) + "\n");
} finally {
  clearTimeout(guard);
}
