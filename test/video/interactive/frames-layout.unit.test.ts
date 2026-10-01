import { describe, expect, test } from "bun:test";

import {
  derivePickerLayout,
  selectionDetails,
  wrapPickerLine,
} from "../../../src/cli/interactive/video-frames/layout";
import type { FramePickerState } from "../../../src/cli/interactive/video-frames/selection";
import { getDisplayWidth } from "../../../src/cli/text-display-width";

const state: FramePickerState = {
  request: { kind: "time", timeMs: { numerator: 1_234n, denominator: 1n } },
  resolved: { frameNumber: 14, startMs: 1_000 },
  glyphs: "unicode",
};
const comfortable = { columns: 100, rows: 40, durationMs: 60_000, state };

describe("video frame adaptive layout", () => {
  test("wraps whole graphemes according to their displayed width", () => {
    const text = "A界e\u0301👩🏽‍💻B";
    const wrapped = wrapPickerLine(text, 3);
    expect(wrapped).toEqual(["A界", "e\u0301👩🏽‍💻", "B"]);
    expect(wrapped.join("")).toBe(text);
    expect(wrapped.map(getDisplayWidth)).toEqual([3, 3, 1]);
  });

  test("a full wave retains essential text and reserves the final row and column", () => {
    const layout = derivePickerLayout(comfortable);
    expect(layout.kind).toBe("full");
    expect(layout.positions).toBeGreaterThanOrEqual(3);
    expect(layout.renderedRows).toBe(layout.lines.length);
    expect(layout.renderedRows).toBeLessThan(comfortable.rows);
    expect(layout.lines.every((line) => getDisplayWidth(line) < comfortable.columns)).toBe(true);
    const text = layout.lines.join("\n");
    expect(text).toContain("precision");
    expect(text).toContain("Left/Right");
    expect(text).toContain("Enter");
    expect(text).toContain("Esc");
    expect(text).toContain("Requested:");
    expect(text).toContain("Resolved: frame 14");
    expect(text).toContain("Actual: 00:00:01.000");
  });

  test("falls from full to compact to direct by measured rows and restores richer presentation", () => {
    const full = derivePickerLayout(comfortable);
    const compact = derivePickerLayout({ ...comfortable, rows: full.renderedRows });
    expect(compact.kind).toBe("compact");
    expect(compact.renderedRows).toBeLessThan(full.renderedRows);
    expect(compact.positions).toBeGreaterThanOrEqual(3);
    const direct = derivePickerLayout({ ...comfortable, rows: compact.renderedRows });
    expect(direct.kind).toBe("direct");
    expect(direct.positions).toBe(0);
    expect(direct.lines.join("\n")).toContain("frame 14");
    expect(derivePickerLayout(comfortable).kind).toBe("full");
    expect(state.request).toEqual({ kind: "time", timeMs: { numerator: 1_234n, denominator: 1n } });
    expect(state.resolved).toEqual({ frameNumber: 14, startMs: 1_000 });
  });

  test("wide source labels consume actual wrapped rows instead of character-count breakpoints", () => {
    const ascii = derivePickerLayout({
      ...comfortable,
      columns: 50,
      rows: 100,
      sourceLabel: "x".repeat(40),
    });
    expect(ascii.kind).toBe("full");
    const rowBudget = ascii.renderedRows + 1;
    const fits = derivePickerLayout({
      ...comfortable,
      columns: 50,
      rows: rowBudget,
      sourceLabel: "x".repeat(40),
    });
    const wide = derivePickerLayout({
      ...comfortable,
      columns: 50,
      rows: rowBudget,
      sourceLabel: "界".repeat(40),
    });
    expect(fits.kind).toBe("full");
    expect(wide.kind).toBe("compact");
    expect(wide.lines.every((line) => getDisplayWidth(line) <= 49)).toBe(true);
    expect(wide.renderedRows).toBeLessThan(rowBudget);
  });

  test("ASCII replacement preserves mirrored geometry, selected position, and precise state", () => {
    const unicode = derivePickerLayout(comfortable);
    const ascii = derivePickerLayout({ ...comfortable, state: { ...state, glyphs: "ascii" } });
    expect(ascii.kind).toBe(unicode.kind);
    expect(ascii.positions).toBe(unicode.positions);
    expect(ascii.selectedPosition).toBe(unicode.selectedPosition);
    expect(ascii.renderedRows).toBe(unicode.renderedRows);
    const unicodeWave = unicode.lines.filter((line) => /^[ │▼▲]+$/u.test(line));
    const asciiWave = ascii.lines.filter((line) => /^[ |v^]+$/u.test(line));
    expect(unicodeWave.some((line) => line.includes("▼"))).toBe(true);
    expect(unicodeWave.some((line) => line.includes("▲"))).toBe(true);
    expect(asciiWave).toEqual(
      unicodeWave.map((line) =>
        line.replaceAll("│", "|").replaceAll("▼", "v").replaceAll("▲", "^"),
      ),
    );
    expect(unicode.lines.join("\n")).toContain("A ASCII");
    expect(ascii.lines.join("\n")).toContain("A Unicode");
  });

  test("both wave layouts mirror their halves and align tallest bars with the selection markers", () => {
    const full = derivePickerLayout(comfortable);
    const compact = derivePickerLayout({ ...comfortable, rows: full.renderedRows });
    for (const layout of [full, compact]) {
      const bars = layout.lines.filter((line) => /^[ │]+$/u.test(line) && line.includes("│"));
      const top = layout.lines.find((line) => /^[ ]*▼$/u.test(line));
      const bottom = layout.lines.find((line) => /^[ ]*▲$/u.test(line));
      expect(top).toBeDefined();
      expect(bottom).toBeDefined();
      const selectedColumn = top!.indexOf("▼");
      expect(bottom!.indexOf("▲")).toBe(selectedColumn);
      expect(bars.length).toBeGreaterThanOrEqual(3);
      expect(bars.length % 2).toBe(1);
      expect(bars.every((line) => line[selectedColumn] === "│")).toBe(true);
      for (let row = 0; row < bars.length; row++) {
        expect(bars[row]).toBe(bars[bars.length - row - 1]);
      }
    }
  });

  test("first and last selectors stay anchored while showing the actual resolved start", () => {
    const first = derivePickerLayout({
      ...comfortable,
      state: { request: { kind: "first" }, glyphs: "unicode" },
    });
    const last = derivePickerLayout({
      ...comfortable,
      state: {
        request: { kind: "last" },
        resolved: { frameNumber: 88, startMs: 59_000 },
        glyphs: "unicode",
      },
    });
    expect(first.selectedPosition).toBe(0);
    expect(last.selectedPosition).toBe(last.positions - 1);
    expect(last.lines.join("\n")).toContain("Actual: 00:00:59.000");
  });

  test("unknown or unusable dimensions and duration select direct input", () => {
    for (const columns of [undefined, 0, -1, NaN, Infinity, 10.5, 1]) {
      expect(derivePickerLayout({ ...comfortable, columns }).kind).toBe("direct");
    }
    for (const rows of [undefined, 0, -1, NaN, Infinity, 10.5, 1]) {
      expect(derivePickerLayout({ ...comfortable, rows }).kind).toBe("direct");
    }
    for (const durationMs of [undefined, 0, -1, NaN, Infinity, 1.5]) {
      expect(derivePickerLayout({ ...comfortable, durationMs }).kind).toBe("direct");
    }
    expect(derivePickerLayout({ ...comfortable, simple: true }).kind).toBe("direct");
  });

  test("direct input retains a resolved ordinal whose presentation time is unavailable", () => {
    const noTiming: FramePickerState = {
      request: { kind: "frame", frameNumber: 37 },
      resolved: { frameNumber: 37 },
      glyphs: "ascii",
    };
    const layout = derivePickerLayout({ ...comfortable, state: noTiming });
    expect(layout.kind).toBe("direct");
    expect(layout.lines.join("\n")).toContain("Resolved: frame 37");
    expect(layout.lines.join("\n")).toContain("time unavailable");
    expect(layout.lines.join("\n")).not.toContain("A Unicode");
    expect(noTiming.resolved).toEqual({ frameNumber: 37 });
  });

  test("unresolved candidates do not claim an exact source identity", () => {
    const candidate: FramePickerState = { request: { kind: "first" }, glyphs: "unicode" };
    expect(selectionDetails(candidate).join("\n")).toContain("Candidate:");
    expect(selectionDetails(candidate).join("\n")).not.toContain("Resolved:");
  });
});
