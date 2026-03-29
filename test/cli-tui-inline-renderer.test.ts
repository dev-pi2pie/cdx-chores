import { describe, expect, test } from "bun:test";

import { createInlinePromptRenderer } from "../src/cli/tui";
import { VirtualTerminal, wrapAscii } from "./helpers/virtual-terminal";

class CaptureWriteStream {
  isTTY = true;
  columns: number;
  writes: string[] = [];

  constructor(columns: number) {
    this.columns = columns;
  }

  write(chunk: string | Uint8Array): boolean {
    this.writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }

  get text(): string {
    return this.writes.join("");
  }
}

describe("cli tui inline renderer", () => {
  test("repainting a wrapped prompt clears stale rows before drawing the next frame", () => {
    const stdout = new CaptureWriteStream(20);
    const renderer = createInlinePromptRenderer(stdout as unknown as NodeJS.WritableStream);

    const before = "Path ./multi-folder-sample/reports/2026/03/Field Report 2026-03-05.csv";
    const after = "Path ./short.csv";

    renderer.render({
      prefixText: before,
      ghostText: "",
    });

    renderer.render({
      prefixText: after,
      ghostText: "",
    });

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);

    expect(terminal.getVisibleLines()).toEqual(wrapAscii(after, stdout.columns));
  });

  test("repainting with a wrapped ghost suffix clears from the active cursor row", () => {
    const stdout = new CaptureWriteStream(20);
    const renderer = createInlinePromptRenderer(stdout as unknown as NodeJS.WritableStream);

    renderer.render({
      prefixText: "Path ./multi-folder-sample/reports/2026/03/Field Rep",
      ghostText: "ort 2026-03-05.csv",
    });

    renderer.render({
      prefixText: "Path ./multi-folder-sample/reports/2026/03/Field Repo",
      ghostText: "rt 2026-03-05.csv",
    });

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);

    expect(terminal.getVisibleLines()).toEqual(
      wrapAscii(
        "Path ./multi-folder-sample/reports/2026/03/Field Report 2026-03-05.csv",
        stdout.columns,
      ),
    );
  });

  test("repainting from a wrapped ghost frame to a shorter single-line frame clears orphaned rows", () => {
    const stdout = new CaptureWriteStream(20);
    const renderer = createInlinePromptRenderer(stdout as unknown as NodeJS.WritableStream);

    renderer.render({
      prefixText: "Path ./multi-folder-sample/reports/2026/03/Field Rep",
      ghostText: "ort 2026-03-05.csv",
    });

    renderer.render({
      prefixText: "Path ./short.csv",
      ghostText: "",
    });

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);

    expect(terminal.getVisibleLines()).toEqual(wrapAscii("Path ./short.csv", stdout.columns));
  });

  test("repainting after an exact-width frame clears from the same visual row", () => {
    const stdout = new CaptureWriteStream(20);
    const renderer = createInlinePromptRenderer(stdout as unknown as NodeJS.WritableStream);

    renderer.render({
      prefixText: "12345678901234567890",
      ghostText: "",
    });

    renderer.render({
      prefixText: "short",
      ghostText: "",
    });

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);

    expect(terminal.getVisibleLines()).toEqual(["short"]);
  });

  test("repainting after an exact-width prefix with ghost text clears correctly", () => {
    const stdout = new CaptureWriteStream(20);
    const renderer = createInlinePromptRenderer(stdout as unknown as NodeJS.WritableStream);

    renderer.render({
      prefixText: "12345678901234567890",
      ghostText: ".csv",
    });

    renderer.render({
      prefixText: "short",
      ghostText: ".csv",
    });

    const terminal = new VirtualTerminal(stdout.columns);
    terminal.write(stdout.text);

    expect(terminal.getVisibleLines()).toEqual(["short.csv"]);
  });
});
