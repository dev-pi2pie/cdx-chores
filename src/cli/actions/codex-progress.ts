import { printLine } from "./shared";

export type DirectCodexProgressStatus = "done" | "fallback" | "error";

export interface DirectCodexProgress {
  stop(status: DirectCodexProgressStatus): void;
}

interface TtyWritableStream extends NodeJS.WritableStream {
  isTTY?: boolean;
}

export function startDirectCodexProgress(
  stream: NodeJS.WritableStream,
  label: string,
  options: { clearLine?: boolean } = {},
): DirectCodexProgress {
  const ttyStream = stream as TtyWritableStream;

  if (!ttyStream.isTTY) {
    printLine(stream, `${label}...`);
    return { stop: () => {} };
  }

  const frames = ["-", "\\", "|", "/"];
  let frameIndex = 0;
  let stopped = false;

  const render = () => {
    const frame = frames[frameIndex % frames.length] ?? "-";
    frameIndex += 1;
    stream.write(`\r${options.clearLine === false ? "" : "\x1b[2K"}${label}... ${frame}`);
  };

  render();
  const timer = setInterval(render, 120);

  return {
    stop(status) {
      if (stopped) {
        return;
      }
      stopped = true;
      clearInterval(timer);
      stream.write(`\r${options.clearLine === false ? "" : "\x1b[2K"}${label}... ${status}\n`);
    },
  };
}
