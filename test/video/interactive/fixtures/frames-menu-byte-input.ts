import assert from "node:assert/strict";
import {
  chooseFrameOption,
  enterFrameValue,
} from "../../../../src/cli/interactive/video-frames/simple-prompts";
import { promptFrameNaming } from "../../../../src/cli/interactive/video-frames/naming";
import { promptFrameImageSettings } from "../../../../src/cli/interactive/video-frames/settings";
import { resolvePathPromptRuntimeConfig } from "../../../../src/cli/prompts/path-config";
import { frameMenuStreams, flush, keys } from "./frames-menu-input";
import { verifyRawArrows } from "./frames-menu-arrows";

const scenario = process.argv[2]!;
const method = process.argv[3]!;
assert.equal(method, "raw");
const encoders = {
  png: "supported",
  jpg: "supported",
  webp: "supported",
  webpEncoder: "supported",
  webpBgra: "supported",
  webpLossless: "supported",
} as const;

async function reuse(s: ReturnType<typeof frameMenuStreams>) {
  const prompt = enterFrameValue(s.io, {
    message: "Next ordinary input",
    validate: (value) => value === "ready" || "Required",
  });
  await s.wait("Next ordinary input");
  s.actualInput.write("ready" + keys.enter);
  const result = await prompt;
  assert.equal(result, "ready");
  await s.clean();
  return result;
}

async function selectBack() {
  const s = frameMenuStreams();
  let settled = 0;
  const choices = [
    { name: "First", value: "first" },
    { name: "Second", value: "second" },
    { name: "Back", value: "back" },
  ];
  const prompt = chooseFrameOption(s.io, "Raw selection", choices, "back").then((value) => {
    settled++;
    return value;
  });
  await s.wait("Raw selection");
  s.actualInput.write(keys.escape);
  const back = await prompt;
  assert.equal(back, "back");
  await s.clean();
  assert.equal(settled, 1);
  const next = chooseFrameOption(s.io, "Reused selection", choices, "back");
  await s.wait("Reused selection");
  s.actualInput.write(keys.down + keys.enter);
  const selected = await next;
  assert.equal(selected, "second");
  await s.clean();
  return { back, selected, ordinary: await reuse(s) };
}

async function naming(simple: boolean) {
  const s = frameMenuStreams();
  let settled = false;
  const prompt = promptFrameNaming({ ...s.io, simple }, "single").then((value) => {
    settled = true;
    return value;
  });
  await s.wait("Image naming");
  await s.step(keys.down + keys.enter, "Filename template");
  const draft = "clip-{frame}";
  s.actualInput.write(draft);
  await flush();
  await s.step(keys.escape, "Image naming");
  assert.equal(settled, false, "One Escape must return to the naming choice");
  await s.step(keys.enter, "Filename template");
  assert(
    s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("Filename template")).includes(draft),
  );
  s.actualInput.write("-kept" + keys.enter);
  const result = await prompt;
  assert.deepEqual(result, { template: "clip-{frame}-kept" });
  await s.clean();
  return { result, ordinary: await reuse(s) };
}

async function path(simple: boolean) {
  const s = frameMenuStreams();
  let settled = false;
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
  ).then((value) => {
    settled = true;
    return value;
  });
  await s.wait("Image format");
  await s.step(keys.enter, "Output scale");
  await s.step(keys.enter, "Where to save the image");
  await s.step(keys.down + keys.enter, "Image file path (.png)");
  const draft = "example/Literal Image.PnG";
  s.actualInput.write(draft);
  await flush();
  await s.step(keys.escape, "Where to save the image");
  assert.equal(settled, false, "One Escape must return to destination selection");
  await s.step(keys.enter, "Image file path (.png)");
  assert(
    s.actualOutput.text.slice(s.actualOutput.text.lastIndexOf("Image file path")).includes(draft),
  );
  await s.step(keys.enter, "Existing output images");
  s.actualInput.write(keys.enter);
  const result = await prompt;
  assert.deepEqual(result, {
    format: "png",
    quality: "full",
    scale: 1,
    destination: { kind: "file", path: draft },
    overwrite: false,
  });
  await s.clean();
  return { result, ordinary: await reuse(s) };
}

const guard = setTimeout(() => {
  process.stderr.write("Frame menu byte fixture timed out: " + scenario + "\n");
  process.exit(1);
}, 10_000);
try {
  let observation: unknown;
  if (scenario === "raw-select-back-and-reuse") observation = await selectBack();
  else if (scenario === "raw-simple-draft-return") observation = await naming(true);
  else if (scenario === "raw-inline-draft-return") observation = await naming(false);
  else if (scenario === "raw-inline-path-return") observation = await path(false);
  else if (scenario === "raw-simple-path-return") observation = await path(true);
  else if (scenario === "raw-fragmented-arrows")
    observation = await verifyRawArrows(process.argv[4]!);
  else throw new Error("Unknown menu byte scenario");
  process.stdout.write(JSON.stringify({ scenario, method, observation, passed: true }) + "\n");
} finally {
  clearTimeout(guard);
}
