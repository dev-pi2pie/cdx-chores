import { getDisplayWidth } from "../../text-display-width";
import {
  describeFrameRequest,
  formatFrameTime,
  isUsableDuration,
  nearestPosition,
  selectionPosition,
  type FramePickerState,
} from "./selection";

export interface PickerLayout {
  kind: "full" | "compact" | "direct";
  lines: string[];
  positions: number;
  selectedPosition: number;
  renderedRows: number;
}

export function wrapPickerLine(line: string, columns: number): string[] {
  line = line.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ");
  const lines: string[] = [];
  let current = "";
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    line,
  )) {
    if (getDisplayWidth(current + segment) > columns && current.length > 0) {
      lines.push(current);
      current = "";
    }
    current += segment;
  }
  lines.push(current);
  return lines;
}

export function selectionDetails(state: FramePickerState): string[] {
  const lines = [
    `${state.resolved ? "Requested" : "Candidate"}: ${describeFrameRequest(state.request)}`,
  ];
  if (state.resolved) {
    lines.push(
      `Resolved: frame ${state.resolved.frameNumber} | Actual: ${state.resolved.startMs === undefined ? "time unavailable" : formatFrameTime(state.resolved.startMs)}`,
    );
    const actual = state.resolved.startMs;
    if (typeof actual === "object" && actual.numerator % actual.denominator !== 0n)
      lines.push(
        "Actual time retains sub-millisecond precision; the displayed clock is truncated.",
      );
  }
  return lines;
}
export function directPickerTitle(state: FramePickerState): string {
  const request =
    state.request.kind === "time"
      ? formatFrameTime(state.request.timeMs)
      : state.request.kind === "frame"
        ? `#${state.request.frameNumber}`
        : state.request.kind === "first"
          ? "First"
          : "Last";
  const actual = state.resolved?.startMs;
  const truncated = typeof actual === "object" && actual.numerator % actual.denominator !== 0n;
  return `Frame/time: ${request}${state.resolved ? ` · F${state.resolved.frameNumber}${actual === undefined ? "" : ` @${truncated ? "~" : ""}${formatFrameTime(actual)}`}` : ""}`;
}

export function derivePickerLayout(options: {
  columns?: number;
  rows?: number;
  durationMs?: number;
  durationIsEstimate?: boolean;
  state: FramePickerState;
  sourceLabel?: string;
  simple?: boolean;
}): PickerLayout {
  const { columns, rows, durationMs, state } = options;
  const details = selectionDetails(state);
  const direct: PickerLayout = {
    kind: "direct",
    positions: 0,
    selectedPosition: 0,
    renderedRows: 0,
    lines: [...details, "Use frame/time input for precision. Exact count may be unavailable."],
  };
  if (
    options.simple ||
    !Number.isSafeInteger(columns) ||
    !Number.isSafeInteger(rows) ||
    columns! < 1 ||
    rows! < 1 ||
    !isUsableDuration(durationMs) ||
    !selectionPosition(state, durationMs)
  )
    return direct;

  // Leave the terminal's final cell unused to avoid delayed-autowrap ambiguity.
  const width = columns! - 1;
  if (width < 1) return direct;
  const header = `Pick a frame${options.sourceLabel ? ` · ${options.sourceLabel}` : ""} · ${options.durationIsEstimate ? "Estimated duration" : "Duration"} ${formatFrameTime(durationMs)}`;
  const controls = [
    "Timeline is a coarse overview. Use frame/time input for precision.",
    "Left/Right Move   F Frame   T Time",
    `A ${state.glyphs === "unicode" ? "ASCII" : "Unicode"}   Enter Select   Esc Back`,
  ];
  for (const [kind, height, spacing] of [
    ["full", 5, 4],
    ["compact", 2, 2],
  ] as const) {
    const positions = Math.min(61, Math.floor((width - 1) / spacing) + 1);
    if (positions < 3) continue;
    const waveWidth = (positions - 1) * spacing + 1;
    const start = "00:00";
    const end = formatFrameTime(durationMs).slice(0, -4);
    if (getDisplayWidth(start) + getDisplayWidth(end) + 1 > waveWidth) continue;
    const selected = nearestPosition(state, durationMs, positions);
    const top = state.glyphs === "unicode" ? "▼" : "v";
    const bottom = state.glyphs === "unicode" ? "▲" : "^";
    const stroke = state.glyphs === "unicode" ? "│" : "|";
    const bars = Array.from({ length: height }, (_, level) =>
      Array.from({ length: positions }, (_, index) => {
        const barHeight = Math.max(
          1,
          height -
            Math.ceil(
              (Math.abs(index - selected) * (height - 1)) / Math.max(1, (positions - 1) / 2),
            ),
        );
        return barHeight > height - level - 1 ? stroke : " ";
      }).join(" ".repeat(spacing - 1)),
    );
    const axis =
      start + " ".repeat(waveWidth - getDisplayWidth(start) - getDisplayWidth(end)) + end;
    const step = (durationMs / (positions - 1) / 1_000).toPrecision(3);
    const lines = [
      header,
      " ".repeat(selected * spacing) + top,
      ...bars,
      ...bars.slice(0, -1).reverse(),
      " ".repeat(selected * spacing) + bottom,
      axis,
      ...details,
      `Positions: ${positions} | Step: ~${step}s`,
      ...controls,
    ];
    const wrapped = lines.flatMap((line) => wrapPickerLine(line, width));
    if (wrapped.length < rows!)
      return {
        kind,
        lines: wrapped,
        positions,
        selectedPosition: selected,
        renderedRows: wrapped.length,
      };
  }
  return direct;
}
