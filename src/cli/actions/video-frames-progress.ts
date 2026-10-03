import { getCliColors } from "../colors";
import { getDisplayWidth, truncateToDisplayWidth } from "../text-display-width";
import type { FrameExportProgress } from "../video-frames/export";
import { printLine } from "./shared";

export interface FrameProgressUpdate extends Omit<Partial<FrameExportProgress>, "phase"> {
  phase?: FrameExportProgress["phase"] | "inspecting" | "scanning";
  label?: string;
  total?: bigint;
  totalIsEstimate?: boolean;
}

export interface FrameProgressPresenter {
  update(state: FrameProgressUpdate): void;
  pause(): void;
  stopping(): void;
  stop(): void;
}

const labels = {
  inspecting: "Inspecting video",
  scanning: "Scanning source frames",
  sampling: "Sampling sequence",
  validating: "Validating frames",
  exporting: "Exporting images",
  finishing: "Finishing",
} as const;

/** Presentation only: counters and completion remain owned by the backend. */
export function createFrameProgressPresenter(
  stream: NodeJS.WritableStream,
  options: {
    label: string;
    colorEnabled?: boolean;
    controls?: boolean;
    now?: () => number;
    intervalMs?: number;
  },
): FrameProgressPresenter {
  const terminal = stream as NodeJS.WriteStream;
  const tty = Boolean(terminal.isTTY);
  const colors = getCliColors({ colorEnabled: options.colorEnabled ?? true }, stream);
  const now = options.now ?? (() => performance.now());
  const interval = options.intervalMs ?? 500;
  const began = now();
  let state: FrameProgressUpdate = { label: options.label };
  let stopped = false,
    stopping = false,
    paused = false;
  let lastUpdate = -Infinity,
    tick = 0;
  let previous: string[] = [];
  let previousColumns = 80;
  const columns = () =>
    Number.isSafeInteger(terminal.columns) && terminal.columns > 0 ? terminal.columns : 80;
  const elapsed = () => {
    const seconds = Math.floor(Math.max(0, now() - began) / 1000);
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };
  const clear = () => {
    if (!tty || !previous.length) return;
    // A terminal can reflow the previous lines when its width changes.
    const width = Math.min(previousColumns, columns());
    const rows = previous.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(getDisplayWidth(line) / width)),
      0,
    );
    stream.write(`\r${rows > 1 ? `\x1b[${rows - 1}A` : ""}`);
    for (let row = 0; row < rows; row++) {
      stream.write("\x1b[2K");
      if (row < rows - 1) stream.write("\x1b[1B\r");
    }
    stream.write(`\r${rows > 1 ? `\x1b[${rows - 1}A` : ""}`);
    previous = [];
  };
  const content = () => {
    const label = stopping
      ? "Stopping"
      : (state.label ?? (state.phase ? labels[state.phase] : options.label));
    const counts: string[] = [];
    if (state.inspected !== undefined)
      counts.push(
        `${state.inspected}${state.inspectionTarget === undefined ? "" : ` / ${state.inspectionTarget}`} inspected`,
      );
    if (state.written !== undefined)
      counts.push(
        `${state.written}${state.total === undefined ? "" : ` / ${state.totalIsEstimate ? "approximately " : ""}${state.total}`} written`,
      );
    if (state.decoded !== undefined) counts.push(`${state.decoded} frames extracted`);
    return { label, counts };
  };
  const render = (force = false) => {
    if (stopped || paused) return;
    const current = now();
    if (!force && current - lastUpdate < interval) return;
    lastUpdate = current;
    const { label, counts } = content();
    if (!tty) {
      printLine(stream, [label, ...counts, `Elapsed ${elapsed()}`].join(" | "));
      return;
    }
    clear();
    const width = Math.max(1, columns() - 1);
    const activity = stopping ? "" : `${["-", "\\", "|", "/"][tick++ % 4]} `;
    let first = truncateToDisplayWidth(activity + label, width);
    const primary =
      state.inspected !== undefined
        ? `${state.inspected} inspected`
        : state.written !== undefined
          ? `${state.written} written`
          : "Working";
    const details = counts.length ? counts.join(" | ") : "Working";
    const countLine = truncateToDisplayWidth(
      getDisplayWidth(details) <= width ? details : primary,
      width,
    );
    const fullFooter = `Elapsed ${elapsed()}${options.controls ? " | Esc Cancel | Ctrl+C Exit" : ""}`;
    const narrow = getDisplayWidth(fullFooter) > width;
    const shortFooter = options.controls ? "Esc Cancel | Ctrl+C Exit" : elapsed();
    if (narrow && options.controls && width >= 10)
      first = `${truncateToDisplayWidth(activity + label, width - 8)} | ${elapsed()}`;
    const footer = truncateToDisplayWidth(narrow ? shortFooter : fullFooter, width);
    stream.write(`${colors.cyan(first)}\n${countLine}\n${colors.dim(footer)}`);
    previous = [first, countLine, footer];
    previousColumns = columns();
  };
  const resize = () => render(true);
  if (tty) terminal.on("resize", resize);
  // Quiet phases retain an elapsed-time/activity cue without inventing a count.
  const timer = setInterval(() => {
    if (stopping) return;
    if (tty || now() - lastUpdate >= 10_000) render();
  }, interval);
  timer.unref?.();
  try {
    render(true);
  } catch (error) {
    clearInterval(timer);
    if (tty) terminal.off("resize", resize);
    throw error;
  }
  return {
    update(next) {
      if (stopped || stopping) return;
      const changedPhase = next.phase !== undefined && next.phase !== state.phase;
      state = changedPhase
        ? { total: state.total, totalIsEstimate: state.totalIsEstimate, ...next }
        : { ...state, ...next, ...(next.phase ? { label: undefined } : {}) };
      paused = false;
      render();
    },
    pause() {
      if (stopped) return;
      clear();
      paused = true;
    },
    stopping() {
      if (stopped || stopping) return;
      stopping = true;
      paused = false;
      render(true);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      if (tty) terminal.off("resize", resize);
      clear();
    },
  };
}
