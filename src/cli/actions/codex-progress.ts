import { printLine } from "./shared";

export type DirectCodexProgressStatus = "done" | "fallback" | "error";

export interface CodexProgressPresenter {
  start(label: string): void;
  update(label: string): void;
  stop(status: DirectCodexProgressStatus): void;
}

export interface CodexProgressSession {
  begin(label: string): void;
  stop(status: DirectCodexProgressStatus): void;
}

export interface DirectCodexProgress {
  stop(status: DirectCodexProgressStatus): void;
}

interface TtyWritableStream extends NodeJS.WritableStream {
  isTTY?: boolean;
}

export function createCodexProgressSession(
  presenter: CodexProgressPresenter,
): CodexProgressSession {
  let active = false;
  let stopped = false;
  return {
    begin(label) {
      if (stopped) return;
      if (active) {
        presenter.update(label);
        return;
      }
      active = true;
      presenter.start(label);
    },
    stop(status) {
      if (stopped || !active) return;
      stopped = true;
      presenter.stop(status);
    },
  };
}

export function createDirectCodexProgressPresenter(
  stream: NodeJS.WritableStream,
  options: { clearLine?: boolean } = {},
): CodexProgressPresenter {
  const ttyStream = stream as TtyWritableStream;
  let label: string | undefined;
  let stopped = false;

  if (!ttyStream.isTTY) {
    return {
      start(nextLabel) {
        if (stopped) return;
        label = nextLabel;
        printLine(stream, `${nextLabel}...`);
      },
      update(nextLabel) {
        if (stopped || label === nextLabel) return;
        label = nextLabel;
        printLine(stream, `${nextLabel}...`);
      },
      stop() {
        stopped = true;
      },
    };
  }

  const frames = ["-", "\\", "|", "/"];
  let frameIndex = 0;
  let timer: NodeJS.Timeout | undefined;

  const render = () => {
    if (!label || stopped) return;
    const frame = frames[frameIndex % frames.length] ?? "-";
    frameIndex += 1;
    stream.write(`\r${options.clearLine === false ? "" : "\x1b[2K"}${label}... ${frame}`);
  };

  return {
    start(nextLabel) {
      if (stopped) return;
      label = nextLabel;
      if (!timer) {
        render();
        timer = setInterval(render, 120);
      } else {
        render();
      }
    },
    update(nextLabel) {
      if (stopped || label === nextLabel) return;
      label = nextLabel;
      render();
    },
    stop(status) {
      if (stopped || !label) return;
      stopped = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      stream.write(`\r${options.clearLine === false ? "" : "\x1b[2K"}${label}... ${status}\n`);
    },
  };
}

export function startDirectCodexProgress(
  stream: NodeJS.WritableStream,
  label: string,
  options: { clearLine?: boolean } = {},
): DirectCodexProgress {
  const presenter = createDirectCodexProgressPresenter(stream, options);
  presenter.start(label);
  return { stop: (status) => presenter.stop(status) };
}
