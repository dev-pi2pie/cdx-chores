import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  chooseFrameOption,
  enterFrameValue,
} from "../../../../src/cli/interactive/video-frames/simple-prompts";
import { promptFramePath } from "../../../../src/cli/interactive/video-frames/settings";
import { resolvePathPromptRuntimeConfig } from "../../../../src/cli/prompts/path-config";
import { promptTextWithGhost } from "../../../../src/cli/prompts/text-inline";
import { frameMenuStreams, flush, keys } from "./frames-menu-input";

function track<T>(pending: Promise<T>) {
  let settled = false;
  const result = pending.finally(() => (settled = true));
  void result.catch(() => {});
  return {
    result,
    open: () => assert.equal(settled, false, "Arrow input must not settle a prompt"),
  };
}

async function menuArrows() {
  const s = frameMenuStreams();
  const choices = ["first", "second", "third", "back"].map((value) => ({ name: value, value }));
  const start = (initial = "first") =>
    track(chooseFrameOption(s.io, "Arrow menu", choices, "back", initial));
  const selections: string[] = [];
  for (const [initial, arrow, expected] of [
    ["first", keys.down, "third"],
    ["third", keys.up, "first"],
  ] as const) {
    const prompt = start(initial);
    await s.wait("Arrow menu");
    s.actualInput.write(arrow);
    await flush();
    prompt.open();
    await s.fragment(arrow);
    prompt.open();
    s.actualInput.write(keys.enter);
    const selected = await prompt.result;
    assert.equal(selected, expected);
    selections.push(selected);
    await s.clean();
  }
  const cancel = start();
  await s.wait("Arrow menu");
  cancel.open();
  s.actualInput.write(keys.escape);
  assert.equal(await cancel.result, "back");
  await s.clean();
  const reuse = start();
  await s.wait("Arrow menu");
  reuse.open();
  s.actualInput.write(keys.down + keys.enter);
  const reused = await reuse.result;
  assert.equal(reused, "second");
  await s.clean();
  return { selections, reused };
}

async function simpleArrows() {
  const s = frameMenuStreams();
  const start = () =>
    track(enterFrameValue(s.io, { message: "Arrow input", validate: () => true }));
  const prompt = start();
  await s.wait("Arrow input");
  s.actualInput.write("ac" + keys.left + "b");
  await flush();
  prompt.open();
  await s.fragment(keys.right);
  s.actualInput.write("D");
  await s.fragment(keys.left);
  s.actualInput.write("X" + keys.right + "E");
  await flush();
  prompt.open();
  s.actualInput.write(keys.enter);
  const edited = await prompt.result;
  assert.equal(edited, "abcXDE");
  await s.clean();
  const cancel = start();
  await s.wait("Arrow input");
  cancel.open();
  s.actualInput.write(keys.escape);
  assert.equal(await cancel.result, undefined);
  await s.clean();
  const reuse = start();
  await s.wait("Arrow input");
  reuse.open();
  s.actualInput.write("reused" + keys.enter);
  const reused = await reuse.result;
  assert.equal(reused, "reused");
  await s.clean();
  return { edited, reused };
}

async function inlineArrows() {
  const s = frameMenuStreams();
  let draft = "";
  const start = () =>
    track(
      promptTextWithGhost({
        message: "Arrow completion",
        ghostText: "frame",
        runtimeConfig: resolvePathPromptRuntimeConfig({}),
        stdin: s.io.input,
        stdout: s.io.output,
        validate: () => true,
        onChange: (value) => {
          draft = value;
        },
      }),
    );
  const prompt = start();
  await s.wait("Arrow completion");
  s.actualInput.write(keys.right);
  await flush();
  assert.equal(draft, "frame");
  prompt.open();
  s.actualInput.write("\x15");
  await flush();
  assert.equal(draft, "");
  await s.fragment(keys.right);
  assert.equal(draft, "frame");
  const completed = draft;
  prompt.open();
  s.actualInput.write(keys.escape);
  await assert.rejects(prompt.result, { name: "ExitPromptError" });
  await s.clean();
  const reuse = start();
  await s.wait("Arrow completion");
  reuse.open();
  s.actualInput.write(keys.right + keys.enter);
  const reused = await reuse.result;
  assert.equal(reused, "frame");
  await s.clean();
  return { completed, reused };
}

async function pathArrows(root: string) {
  const s = frameMenuStreams();
  const filename = "arrow-target.png";
  await writeFile(join(root, filename), "synthetic completion fixture");
  let draft = "";
  const start = () =>
    track(
      promptFramePath(
        s.io,
        {
          cwd: root,
          stdin: s.io.input,
          stdout: s.io.output,
          runtimeConfig: resolvePathPromptRuntimeConfig({}),
        },
        "Arrow path",
        "file",
        "png",
        {
          onChange: (value) => {
            draft = value;
          },
        },
      ),
    );
  const prompt = start();
  await s.wait("Arrow path");
  await s.step("arrow-", filename);
  await s.step(keys.right, "Arrow path");
  assert.equal(draft, filename);
  prompt.open();
  await s.step("\x15arrow-", filename);
  const fragmentStart = s.actualOutput.text.length;
  await s.fragment(keys.right);
  await s.wait("Arrow path", fragmentStart);
  assert.equal(draft, filename);
  const completed = draft;
  prompt.open();
  s.actualInput.write(keys.escape);
  assert.equal(await prompt.result, undefined);
  await s.clean();
  const reuse = start();
  await s.wait("Arrow path");
  reuse.open();
  s.actualInput.write("reused.png" + keys.enter);
  const reused = await reuse.result;
  assert.equal(reused, "reused.png");
  await s.clean();
  return { completed, reused };
}

export async function verifyRawArrows(root: string) {
  return {
    menu: await menuArrows(),
    simple: await simpleArrows(),
    inline: await inlineArrows(),
    path: await pathArrows(root),
  };
}
