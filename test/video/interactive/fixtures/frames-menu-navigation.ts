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

async function countInformation(): Promise<void> {
  for (const duration of [exact(5_100n), exact(1_000n), undefined]) {
    const s = streams();
    const prompt = promptFrameCadence(s.io, duration, { interval: "1s" });
    await s.wait("Sequence cadence");
    await s.step(enter, "Sampling interval");
    let page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Sampling interval"));
    const expected = duration
      ? duration.numerator === 5_100n
        ? "~6 images"
        : "~1 image"
      : "estimate unavailable";
    assert(page.includes("Every 1s — " + expected));
    assert(page.includes("Counts confirmed during export"));
    if (!duration) assert(page.includes("Duration unavailable"));
    else assert(page.includes("metadata estimate"));
    if (duration?.numerator === 1_000n)
      assert(page.includes("Matches duration — starting image only"));
    await s.step(down.repeat(3), "Every 10s");
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Sampling interval"));
    if (duration) assert(page.includes("Beyond duration — starting image only"));
    s.actualOutput.rows = 8;
    s.actualOutput.columns = 28;
    s.actualOutput.emit("resize");
    await flush();
    s.actualInput.write(up + down);
    await flush();
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Sampling interval"));
    assert(
      page.replaceAll("\n", "").includes(duration ? "~1 image" : "estimate unavailable"),
      "Wrapped row preserves its count: " + page,
    );
    assert(page.includes("Counts confirmed at export"));
    assert(page.includes("Up/Down | Enter | Esc Back"));
    if (duration) {
      assert(page.includes("Metadata duration ~"));
      assert(page.includes("Beyond: start image only"));
    }
    assert(
      page.trimEnd().split("\n").length <= 8,
      "Compact interval information fits the measured area",
    );
    s.actualOutput.rows = 32;
    s.actualOutput.columns = 100;
    s.actualOutput.emit("resize");
    await flush();
    s.actualInput.write(up + down);
    await flush();
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Sampling interval"));
    assert(page.includes("Counts confirmed during export"));
    s.actualInput.write(enter);
    assert.deepEqual(await prompt, { interval: "10s" });
    s.clean();
  }
  const verified = streams();
  const verifiedPrompt = promptFrameCadence(verified.io, exact(5_100n), { interval: "1s" }, false);
  await verified.wait("Sequence cadence");
  await verified.step(enter, "Sampling interval");
  const verifiedPage = verified.actualOutput.text.slice(
    verified.actualOutput.text.lastIndexOf("? Sampling interval"),
  );
  assert(verifiedPage.includes("Every 1s — ~6 images"));
  assert(verifiedPage.includes("Duration 00:00:05.100 (decoded end)"));
  assert(!verifiedPage.includes("metadata estimate"));
  verified.actualInput.write(enter);
  assert.deepEqual(await verifiedPrompt, { interval: "1s" });
  verified.clean();
  const s = streams();
  const prompt = promptFrameCadence(s.io, exact(5_100n), { interval: "7s" });
  await s.wait("Sequence cadence");
  await s.step(enter, "Sampling interval");
  await s.step(enter, "Interval (positive");
  assert(s.actualOutput.text.includes("~1 image"));
  assert(s.actualOutput.text.includes("Beyond duration — starting image only"));
  await s.step("\x7f\x7f0s" + enter, "positive safe");
  await s.step("\x7f\x7f1s", "~6 images");
  s.actualInput.write(enter);
  assert.deepEqual(await prompt, { interval: "1s" });
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
  await s.step(enter, "Where to save the image");
  await s.step(down + enter, "Image file path (.jpg)");
  s.actualInput.write("synthetic-image.jp");
  await flush();
  await s.step(escape, "Where to save the image");
  await s.step(enter, "Image file path (.jpg)");
  assert(
    s.actualOutput.text
      .slice(s.actualOutput.text.lastIndexOf("Image file path"))
      .includes("synthetic-image.jp"),
  );
  await s.step("g" + enter, "Existing output images");
  await s.step(escape, "Image file path (.jpg)");
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

const pathContext = (s: ReturnType<typeof streams>) => ({
  cwd: process.cwd(),
  stdin: s.io.input,
  stdout: s.io.output,
  runtimeConfig: resolvePathPromptRuntimeConfig({}),
});
const selectedFirst = [
  { selection: "first" as const, identity: { frameNumber: 1, streamIndex: 0 } },
];

async function destinationInformation(): Promise<void> {
  for (const mode of ["single", "set", "sequence"] as const) {
    const destinationLabel =
      mode === "single" ? "Where to save the image" : "Where to save the images";
    const s = streams();
    s.actualOutput.rows = 32;
    s.actualOutput.columns = 100;
    const prompt = promptFrameImageSettings(
      { ...s.io, simple: true },
      pathContext(s),
      mode,
      encoders,
      undefined,
      { source: "clip.mov", selections: selectedFirst },
    );
    await s.wait("Image format");
    await s.step(enter, "Output scale");
    await s.step(enter, destinationLabel);
    let page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? " + destinationLabel));
    const hint = mode === "single" ? "Image beside the source" : "Frames folder beside the source";
    assert(page.includes("Use default output"));
    assert(page.includes(mode === "single" ? "Custom image file" : "Custom folder"));
    assert(!page.includes(mode === "single" ? "Custom folder" : "Custom image file"));
    assert(page.includes(hint));
    assert(!page.includes("clip"));
    s.actualOutput.rows = 8;
    s.actualOutput.columns = 28;
    s.actualOutput.emit("resize");
    await flush();
    s.actualInput.write(down + up);
    await flush();
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? " + destinationLabel));
    assert(page.replaceAll("\n", "").includes(hint));
    assert(page.includes("Up/Down | Enter | Esc Back"));
    assert(page.trimEnd().split("\n").length <= 8);
    s.actualOutput.rows = 32;
    s.actualOutput.columns = 100;
    s.actualOutput.emit("resize");
    await flush();
    const acceptedStart = s.actualOutput.text.length;
    await s.step(enter, "Image naming");
    assert(
      s.actualOutput.text.slice(acceptedStart).includes(destinationLabel + " Use default output"),
    );
    if (mode === "sequence") {
      await s.step(enter, "Serial start");
      await s.step(enter, "Minimum serial width");
    }
    await s.step(enter, "Existing output images");
    s.actualInput.write(enter);
    assert.equal((await prompt)?.destination.kind, "default");
    s.clean();
  }
}

async function namingInformation(): Promise<void> {
  for (const format of ["png", "webp"] as const) {
    const s = streams();
    s.actualOutput.rows = 32;
    s.actualOutput.columns = 100;
    const prompt = promptFrameNaming(
      { ...s.io, simple: true },
      "sequence",
      { template: "{stem}-{serial_start_7_##}", serialStart: 9, serialWidth: 3 },
      { source: "clip.mov", format },
    );
    await s.wait("Image naming");
    let page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Image naming"));
    assert(page.includes("Source stem: clip"));
    assert(page.includes("Extension: ." + format));
    assert(page.includes("Serial start: 9 · Minimum width: 3"));
    assert(page.includes(`Example: clip-009.${format}`));
    await s.step(down, "Default template");
    s.actualOutput.rows = 8;
    s.actualOutput.columns = 28;
    s.actualOutput.emit("resize");
    await flush();
    s.actualInput.write(down + up);
    await flush();
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? Image naming"));
    assert(page.includes("{stem}-{serial} · Stem clip"));
    assert(page.includes(`Start 9 · Width 3 · .${format}`), page);
    assert(page.includes(`Example clip-009.${format}`));
    assert(page.includes("Up/Down | Enter | Esc Back"));
    assert(page.trimEnd().split("\n").length <= 8);
    s.actualOutput.rows = 32;
    s.actualOutput.columns = 100;
    s.actualOutput.emit("resize");
    await flush();
    await s.step(enter, "Serial start");
    await s.step("\x7f11" + enter, "Minimum serial width");
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("Minimum serial width"));
    assert(page.includes(`Example: clip-011.${format}`));
    const refreshedStart = s.actualOutput.text.length;
    s.actualInput.write("\x7f4");
    await s.wait(`Example: clip-0011.${format}`, refreshedStart);
    s.actualInput.write(enter);
    assert.deepEqual(await prompt, {
      template: "{stem}-{serial}",
      serialStart: 11,
      serialWidth: 4,
    });
    s.clean();
  }
}

async function customDestinations(simple: boolean): Promise<void> {
  for (const mode of ["single", "set", "sequence"] as const) {
    const s = streams();
    s.actualOutput.rows = 32;
    s.actualOutput.columns = 100;
    const prompt = promptFrameImageSettings({ ...s.io, simple }, pathContext(s), mode, encoders);
    const destinationLabel =
      mode === "single" ? "Where to save the image" : "Where to save the images";
    const pathLabel = mode === "single" ? "Image file path (.png)" : "Folder path";
    const literal = mode === "single" ? "example/Literal Image.PnG" : "example/images";
    await s.wait("Image format");
    await s.step(enter, "Output scale");
    await s.step(enter, destinationLabel);
    await s.step(down + enter, pathLabel);
    assert(
      s.actualOutput.text.includes(
        mode === "single" ? "Include the filename" : "Images are saved inside this folder",
      ),
    );
    assert(s.actualOutput.text.includes("Relative paths start from where you ran the command"));
    s.actualInput.write(literal);
    await flush();
    await s.step(escape, destinationLabel);
    await s.step(enter, pathLabel);
    assert(s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf(pathLabel)).includes(literal));
    await s.step(enter, mode === "single" ? "Existing output images" : "Image naming");
    if (mode !== "single") {
      if (mode === "sequence") {
        await s.step(enter, "Serial start");
        await s.step(enter, "Minimum serial width");
      }
      await s.step(enter, "Existing output images");
    }
    let page = s.actualOutput.text.slice(
      s.actualOutput.text.lastIndexOf("? Existing output images"),
    );
    assert(page.includes("Stop on filename conflict"));
    assert(page.includes("Stops export on a matching filename"));
    await s.step(down, "Replace each matching file after encoding its image");
    s.actualInput.write(enter);
    const result = await prompt;
    assert.deepEqual(result?.destination, {
      kind: mode === "single" ? "file" : "folder",
      path: literal,
    });
    assert.equal(result?.overwrite, true);
    assert.equal(result?.naming === undefined, mode === "single");
    s.clean();
    const retained = promptFrameImageSettings(
      { ...s.io, simple },
      pathContext(s),
      mode,
      encoders,
      result!,
    );
    await s.wait("Image format", s.actualOutput.text.lastIndexOf("Existing output images"));
    await s.step(enter, "Output scale");
    await s.step(enter, destinationLabel);
    page = s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("? " + destinationLabel));
    assert(page.includes(mode === "single" ? "Keep selected image file" : "Keep selected folder"));
    assert(page.includes(literal));
    await s.step(escape, "Output scale");
    await s.step(down.repeat(6) + enter, "Image format");
    s.actualInput.write(down.repeat(3) + enter);
    assert.equal(await retained, null);
    s.clean();
  }
}

async function retainedFilename(simple: boolean): Promise<void> {
  const s = streams();
  const literal = "Literal  My Image.PnG";
  const initial = {
    format: "png" as const,
    quality: "full" as const,
    scale: 1,
    destination: { kind: "file" as const, path: literal },
    overwrite: false,
  };
  let complete = false;
  const prompt = promptFrameImageSettings(
    { ...s.io, simple },
    pathContext(s),
    "single",
    encoders,
    initial,
    { source: "clip.mov", selections: selectedFirst },
  ).then((value) => {
    complete = true;
    return value;
  });
  await s.wait("Image format");
  await s.step(down.repeat(2) + enter, "Image quality");
  await s.step(enter, "Output scale");
  await s.step(enter, "Where to save the image");
  await s.step(enter, "Image file path (.webp)");
  assert(
    s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("Image file path")).includes(literal),
  );
  await s.step(enter, "extension must match");
  assert.equal(complete, false);
  await s.step(escape, "Where to save the image");
  await s.step(escape, "Output scale");
  await s.step(escape, "Image quality");
  await s.step(escape, "Image format");
  await s.step(up.repeat(2) + enter, "Output scale");
  await s.step(enter, "Where to save the image");
  await s.step(enter, "Image file path (.png)");
  await s.step(enter, "Existing output images");
  s.actualInput.write(enter);
  assert.deepEqual((await prompt)?.destination, { kind: "file", path: literal });
  assert(!s.actualOutput.text.includes("Image naming"), "Explicit files bypass template naming");
  s.clean();

  const jpeg = streams();
  const jpegPrompt = promptFrameImageSettings(
    { ...jpeg.io, simple },
    pathContext(jpeg),
    "single",
    encoders,
    { ...initial, destination: { kind: "file", path: "Literal Image.JPEG" } },
  );
  await jpeg.wait("Image format");
  await jpeg.step(down + enter, "Image quality");
  await jpeg.step(enter, "Output scale");
  await jpeg.step(enter, "Where to save the image");
  await jpeg.step(enter, "Existing output images");
  jpeg.actualInput.write(enter);
  assert.deepEqual((await jpegPrompt)?.destination, { kind: "file", path: "Literal Image.JPEG" });
  assert(!jpeg.actualOutput.text.includes("Image file path"));
  jpeg.clean();
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
  else if (scenario === "count-information") await countInformation();
  else if (scenario === "destination-information") await destinationInformation();
  else if (scenario === "custom-destinations-inline") await customDestinations(false);
  else if (scenario === "custom-destinations-simple") await customDestinations(true);
  else if (scenario === "naming-information") await namingInformation();
  else if (scenario === "retained-filename-inline") await retainedFilename(false);
  else if (scenario === "retained-filename-simple") await retainedFilename(true);
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
