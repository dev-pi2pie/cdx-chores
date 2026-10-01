import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { createFrameProgressPresenter } from "../../../src/cli/actions/video-frames-progress";
import { getDisplayWidth } from "../../../src/cli/text-display-width";

function output(tty: boolean, columns = 80) {
  const stream = Object.assign(new PassThrough(), { isTTY: tty, columns, rows: 8 });
  const writes: string[] = [];
  stream.on("data", (chunk) => writes.push(String(chunk)));
  return { stream, writes, text: () => writes.join("") };
}

test("plain progress is throttled, distinguishes units and estimates, and never asserts completion", () => {
  const io = output(false);
  let clock = 0;
  const presenter = createFrameProgressPresenter(io.stream, {
    label: "Inspecting video",
    now: () => clock,
  });
  try {
    presenter.update({ phase: "sampling", inspected: 100 });
    clock = 499;
    presenter.update({ phase: "sampling", inspected: 101 });
    expect(io.writes).toHaveLength(1);
    clock = 500;
    presenter.update({
      phase: "exporting",
      written: 7,
      decoded: 2,
      total: 10n,
      totalIsEstimate: true,
    });
    expect(io.writes).toHaveLength(2);
    expect(io.writes.at(-1)).toContain("7 / approximately 10 written | 2 frames extracted");
    expect(io.writes.at(-1)).not.toContain("101 inspected");
    clock = 1000;
    presenter.update({ phase: "finishing", written: 10 });
    expect(io.writes.at(-1)).toContain("Finishing");
    expect(io.text()).not.toMatch(/100%|completed|Done/);
    expect(io.text()).not.toContain("\x1b");
  } finally {
    presenter.stop();
  }
});

test("quiet terminal work has an activity cue and stops all redraws before the next owner", async () => {
  const io = output(true);
  const presenter = createFrameProgressPresenter(io.stream, {
    label: "Inspecting video",
    colorEnabled: false,
    intervalMs: 20,
  });
  presenter.update({ phase: "sampling" });
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(stripVTControlCharacters(io.text())).toContain("Sampling sequence");
  expect(stripVTControlCharacters(io.text())).toContain("Elapsed");
  expect(io.writes.filter((line) => line.includes("\n")).length).toBeGreaterThan(1);
  presenter.pause();
  const paused = io.text();
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(io.text()).toBe(paused);
  presenter.stop();
  expect(io.stream.listenerCount("resize")).toBe(0);
  io.stream.write("Next prompt\n");
  const final = io.text();
  await new Promise((resolve) => setTimeout(resolve, 40));
  io.stream.emit("resize");
  expect(io.text()).toBe(final);
});

test("resize retains accurate counts, elapsed time and cancellation controls within narrow rows", () => {
  const io = output(true);
  let clock = 0;
  const presenter = createFrameProgressPresenter(io.stream, {
    label: "Inspecting video",
    colorEnabled: false,
    controls: true,
    now: () => clock,
  });
  try {
    clock = 1500;
    presenter.update({
      phase: "exporting",
      written: 7,
      decoded: 2,
      total: 10n,
      totalIsEstimate: true,
    });
    io.stream.columns = 28;
    io.stream.emit("resize");
    const narrow = stripVTControlCharacters(
      io.writes.filter((line) => line.includes("\n")).at(-1)!,
    );
    expect(narrow).toContain("7 written");
    expect(narrow).toContain("00:01");
    expect(narrow).toContain("Esc Cancel | Ctrl+C Exit");
    for (const row of narrow.split("\n")) expect(getDisplayWidth(row)).toBeLessThan(28);
    io.stream.columns = 100;
    io.stream.emit("resize");
    const wide = stripVTControlCharacters(io.writes.filter((line) => line.includes("\n")).at(-1)!);
    expect(wide).toContain("7 / approximately 10 written | 2 frames extracted");
  } finally {
    presenter.stop();
  }
});

test("Stopping is idempotent and freezes counters until verified settlement", () => {
  const io = output(false);
  let clock = 0;
  const presenter = createFrameProgressPresenter(io.stream, {
    label: "Exporting images",
    now: () => clock,
  });
  clock = 500;
  presenter.update({ phase: "exporting", written: 3 });
  presenter.stopping();
  const stopping = io.text();
  presenter.stopping();
  clock = 2000;
  presenter.update({ phase: "exporting", written: 999 });
  expect(io.text()).toBe(stopping);
  expect(io.text().match(/Stopping/g)).toHaveLength(1);
  presenter.stop();
  presenter.stop();
  expect(io.text()).not.toContain("completed");
});
