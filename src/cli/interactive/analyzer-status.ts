import { createColors } from "picocolors";
import { printLine } from "../actions/shared";

const ANALYZER_WAITING_FRAMES = [".  ", ".. ", "...", ".. ", ".  "] as const;
const ANALYZER_WAITING_INTERVAL_MS = 360;

interface TtyWritableStream extends NodeJS.WritableStream {
  isTTY?: boolean;
}

export interface InteractiveAnalyzerStatus {
  start(message: string): void;
  update(message: string): void;
  wait(message: string): void;
  stop(): void;
}

function clearStatusLine(stream: NodeJS.WritableStream): void {
  stream.write("\r\x1b[2K");
}

function normalizeAnalyzerStatusMessage(message: string): string {
  if (message.includes("Sampling filenames")) {
    return "sampling";
  }
  if (message.includes("Grouping filename patterns")) {
    return "grouping";
  }
  if (message.includes("Waiting for Codex cleanup suggestions")) {
    return "waiting";
  }
  return message;
}

function renderStatusLine(
  stream: NodeJS.WritableStream,
  message: string,
  colorEnabled: boolean,
): void {
  const pc = createColors(colorEnabled);
  const normalizedMessage = normalizeAnalyzerStatusMessage(message);
  const content = ` ${pc.dim("Codex")} ${pc.white("Thinking...")} ${pc.dim(normalizedMessage)} `;
  stream.write(`\r\x1b[2K${pc.bgBlack(content)}`);
}

function renderWaitingStatusLine(
  stream: NodeJS.WritableStream,
  message: string,
  tick: number,
  colorEnabled: boolean,
): void {
  const pc = createColors(colorEnabled);
  const normalizedMessage = normalizeAnalyzerStatusMessage(message);
  const dots =
    ANALYZER_WAITING_FRAMES[tick % ANALYZER_WAITING_FRAMES.length] ?? "...";
  const content = ` ${pc.dim("Codex")} ${pc.white("Thinking")} ${pc.dim(normalizedMessage)} ${pc.gray(dots)} `;
  stream.write(`\r\x1b[2K${pc.bgBlack(content)}`);
}

export function createInteractiveAnalyzerStatus(
  stream: NodeJS.WritableStream,
  colorEnabled = true,
): InteractiveAnalyzerStatus {
  const ttyStream = stream as TtyWritableStream;

  if (!ttyStream.isTTY) {
    return {
      start(message) {
        printLine(stream, message);
      },
      update(message) {
        printLine(stream, message);
      },
      wait(message) {
        printLine(stream, message);
      },
      stop() {},
    };
  }

  let currentMessage = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let tick = 0;

  const stopTimer = () => {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = undefined;
  };

  return {
      start(message) {
        stopTimer();
        currentMessage = message;
        renderStatusLine(stream, currentMessage, colorEnabled);
      },
      update(message) {
        stopTimer();
        currentMessage = message;
        renderStatusLine(stream, currentMessage, colorEnabled);
      },
      wait(message) {
        stopTimer();
        currentMessage = message;
        tick = 0;
        renderWaitingStatusLine(stream, currentMessage, tick, colorEnabled);
        timer = setInterval(() => {
          tick += 1;
          renderWaitingStatusLine(stream, currentMessage, tick, colorEnabled);
        }, ANALYZER_WAITING_INTERVAL_MS);
      },
    stop() {
      stopTimer();
      clearStatusLine(stream);
    },
  };
}
