import { emitKeypressEvents } from "node:readline";

import type { PathPromptRuntimeConfig } from "./path-config";
import { resolvePathSuggestions } from "./path-suggestions";

type ValidationFn = (value: string) => true | string | Promise<true | string>;

type SuggestionFilter =
  | { targetKind: "any" | "directory"; fileExtensions?: string[] }
  | { targetKind: "any" | "directory"; fileExtensions?: undefined };

interface InlinePathPromptOptions {
  message: string;
  cwd: string;
  kindLabel?: string;
  optional?: boolean;
  defaultHint?: string;
  defaultHintLabel?: string;
  runtimeConfig: PathPromptRuntimeConfig;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  validate: ValidationFn;
  suggestionFilter: SuggestionFilter;
}

interface KeypressInfo {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

interface CycleState {
  replacements: string[];
  index: number;
}

function dim(text: string): string {
  return text.length > 0 ? `\x1b[2m${text}\x1b[22m` : "";
}

function clearLine(stdout: NodeJS.WritableStream): void {
  stdout.write("\r\x1b[2K");
}

function beep(stdout: NodeJS.WritableStream): void {
  stdout.write("\x07");
}

function createPromptAbortError(): Error {
  const error = new Error("User aborted prompt");
  error.name = "ExitPromptError";
  return error;
}

function supportsRawPromptIO(stdin: NodeJS.ReadStream, stdout: NodeJS.WritableStream): boolean {
  const stdoutWithTTY = stdout as NodeJS.WritableStream & { isTTY?: boolean };
  return Boolean(
    stdin.isTTY &&
      stdoutWithTTY.isTTY &&
      typeof (stdin as unknown as { setRawMode?: unknown }).setRawMode === "function",
  );
}

function buildPromptLine(options: {
  message: string;
  value: string;
  ghostSuffix: string;
  showGhost: boolean;
}): { line: string; cursorBackCount: number } {
  const ghostText = options.showGhost ? options.ghostSuffix : "";
  const renderedGhost = ghostText.length > 0 ? dim(ghostText) : "";
  const line = `${options.message} ${options.value}${renderedGhost}`;
  return {
    line,
    cursorBackCount: ghostText.length,
  };
}

function isPrintableInput(str: string, key: KeypressInfo): boolean {
  if (str.length === 0) {
    return false;
  }
  if (key.ctrl || key.meta) {
    return false;
  }
  return key.name !== "return" && key.name !== "enter" && key.name !== "tab";
}

function findLastPathSeparatorIndex(value: string): number {
  return Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
}

function moveToParentPathSegmentValue(value: string): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  let end = value.length;
  while (end > 0 && (value[end - 1] === "/" || value[end - 1] === "\\")) {
    end -= 1;
  }

  if (end === 0) {
    return undefined;
  }

  const trimmed = value.slice(0, end);
  const lastSeparatorIndex = findLastPathSeparatorIndex(trimmed);
  if (lastSeparatorIndex < 0) {
    return "";
  }

  return value.slice(0, lastSeparatorIndex + 1);
}

export async function promptPathInlineGhost(
  options: InlinePathPromptOptions,
): Promise<string> {
  if (!supportsRawPromptIO(options.stdin, options.stdout)) {
    throw new Error("Inline path prompt requires TTY stdin/stdout with raw mode support");
  }

  const stdinWithRawMode = options.stdin as NodeJS.ReadStream & { setRawMode(flag: boolean): void };
  const stdout = options.stdout;

  let value = "";
  let ghostSuffix = "";
  let cycleState: CycleState | undefined;
  let renderScheduled = false;
  let resolvingSuggestions = false;
  let needsRefreshAgain = false;
  let activeRefreshSeq = 0;
  let pendingEscapeAbortTimer: ReturnType<typeof setTimeout> | undefined;
  let escapeSequenceBuffer = "";

  const render = (): void => {
    clearLine(stdout);
    const { line, cursorBackCount } = buildPromptLine({
      message: options.message,
      value,
      ghostSuffix,
      showGhost: true,
    });
    stdout.write(line);
    if (cursorBackCount > 0) {
      stdout.write(`\x1b[${cursorBackCount}D`);
    }
  };

  const scheduleRender = (): void => {
    if (renderScheduled) {
      return;
    }
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      render();
    });
  };

  const computeGhostSuffix = async (): Promise<void> => {
    const refreshSeq = ++activeRefreshSeq;
    const suggestions = await resolvePathSuggestions({
      cwd: options.cwd,
      input: value,
      minChars: options.runtimeConfig.autocomplete.minChars,
      maxSuggestions: options.runtimeConfig.autocomplete.maxSuggestions,
      includeHidden: options.runtimeConfig.autocomplete.includeHidden,
      targetKind: options.suggestionFilter.targetKind,
      fileExtensions: options.suggestionFilter.fileExtensions,
    });

    if (refreshSeq !== activeRefreshSeq) {
      return;
    }

    const best = suggestions[0];
    if (!best || !best.replacement.startsWith(value) || best.replacement.length <= value.length) {
      ghostSuffix = "";
      return;
    }

    ghostSuffix = best.replacement.slice(value.length);
  };

  const refreshGhost = async (): Promise<void> => {
    if (resolvingSuggestions) {
      needsRefreshAgain = true;
      return;
    }

    resolvingSuggestions = true;
    try {
      await computeGhostSuffix();
    } finally {
      resolvingSuggestions = false;
      scheduleRender();
      if (needsRefreshAgain) {
        needsRefreshAgain = false;
        void refreshGhost();
      }
    }
  };

  const startOrAdvanceCycle = async (): Promise<boolean> => {
    if (cycleState && cycleState.replacements.length > 0) {
      cycleState.index = (cycleState.index + 1) % cycleState.replacements.length;
      value = cycleState.replacements[cycleState.index] ?? value;
      ghostSuffix = "";
      scheduleRender();
      return true;
    }

    const suggestions = await resolvePathSuggestions({
      cwd: options.cwd,
      input: value,
      minChars: options.runtimeConfig.autocomplete.minChars,
      maxSuggestions: options.runtimeConfig.autocomplete.maxSuggestions,
      includeHidden: options.runtimeConfig.autocomplete.includeHidden,
      targetKind: options.suggestionFilter.targetKind,
      fileExtensions: options.suggestionFilter.fileExtensions,
    });

    const replacements = suggestions.map((item) => item.replacement);
    if (replacements.length === 0) {
      return false;
    }

    const deduped: string[] = [];
    for (const replacement of replacements) {
      if (!deduped.includes(replacement)) {
        deduped.push(replacement);
      }
    }

    if (deduped.length === 0) {
      return false;
    }

    cycleState = {
      replacements: deduped,
      index: 0,
    };
    value = deduped[0] ?? value;
    ghostSuffix = "";
    scheduleRender();
    return true;
  };

  const resetCycleState = (): void => {
    cycleState = undefined;
  };

  const clearPendingEscapeAbort = (): void => {
    if (!pendingEscapeAbortTimer) {
      return;
    }
    clearTimeout(pendingEscapeAbortTimer);
    pendingEscapeAbortTimer = undefined;
  };

  const scheduleEscapeAbort = (settleReject: (error: unknown) => void): void => {
    clearPendingEscapeAbort();
    pendingEscapeAbortTimer = setTimeout(() => {
      pendingEscapeAbortTimer = undefined;
      escapeSequenceBuffer = "";
      settleReject(createPromptAbortError());
    }, 120);
  };

  const acceptGhostSuffix = async (): Promise<boolean> => {
    if (ghostSuffix.length === 0) {
      return false;
    }

    value += ghostSuffix;
    ghostSuffix = "";
    resetCycleState();
    await refreshGhost();
    return true;
  };

  const moveToParentPathSegment = async (): Promise<boolean> => {
    const nextValue = moveToParentPathSegmentValue(value);
    if (nextValue == null || nextValue === value) {
      return false;
    }

    value = nextValue;
    ghostSuffix = "";
    resetCycleState();
    await refreshGhost();
    return true;
  };

  await refreshGhost();
  scheduleRender();

  return await new Promise<string>((resolve, reject) => {
    let settled = false;

    const settleResolve = (result: string): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      clearLine(stdout);
      stdout.write(`${options.message} ${result}\n`);
      resolve(result);
    };

    const settleReject = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      clearLine(stdout);
      stdout.write("\n");
      reject(error);
    };

    const keypressHandler = (str: string, key: KeypressInfo = {}): void => {
      void (async () => {
        if (key.name !== "escape") {
          clearPendingEscapeAbort();
        }

        if (escapeSequenceBuffer.length > 0 && key.name !== "escape") {
          escapeSequenceBuffer += str;

          if (key.name === "right" || escapeSequenceBuffer === "\x1b[C") {
            escapeSequenceBuffer = "";
            const accepted = await acceptGhostSuffix();
            if (!accepted) {
              beep(stdout);
              scheduleRender();
            }
            return;
          }

          if (key.name === "left" || escapeSequenceBuffer === "\x1b[D") {
            escapeSequenceBuffer = "";
            const moved = await moveToParentPathSegment();
            if (!moved) {
              beep(stdout);
              scheduleRender();
            }
            return;
          }

          if (
            key.name === "up" ||
            key.name === "down" ||
            escapeSequenceBuffer === "\x1b[A" ||
            escapeSequenceBuffer === "\x1b[B"
          ) {
            escapeSequenceBuffer = "";
            scheduleRender();
            return;
          }

          if (
            escapeSequenceBuffer === "\x1b[" ||
            escapeSequenceBuffer === "\x1bO" ||
            escapeSequenceBuffer === "\x1b[1;" ||
            escapeSequenceBuffer === "\x1b[1;2"
          ) {
            return;
          }

          // If this was not a recognized escape sequence, drop sequence state and continue.
          escapeSequenceBuffer = "";
        }

        if (key.ctrl && key.name === "c") {
          settleReject(createPromptAbortError());
          return;
        }

        if (key.name === "escape") {
          escapeSequenceBuffer = "\x1b";
          scheduleEscapeAbort(settleReject);
          return;
        }

        if (key.name === "return" || key.name === "enter") {
          const validation = await options.validate(value);
          if (validation === true) {
            settleResolve(value);
            return;
          }
          beep(stdout);
          scheduleRender();
          return;
        }

        if (key.name === "tab") {
          const cycled = await startOrAdvanceCycle();
          if (!cycled) {
            beep(stdout);
            scheduleRender();
          }
          return;
        }

        if (key.name === "right") {
          const accepted = await acceptGhostSuffix();
          if (!accepted) {
            beep(stdout);
            scheduleRender();
          }
          return;
        }

        if (key.name === "left") {
          const moved = await moveToParentPathSegment();
          if (!moved) {
            beep(stdout);
            scheduleRender();
          }
          return;
        }

        if (key.name === "up" || key.name === "down") {
          // Explicit no-op for MVP (no per-prompt history yet).
          scheduleRender();
          return;
        }

        if (key.ctrl && key.name === "u") {
          value = "";
          ghostSuffix = "";
          resetCycleState();
          await refreshGhost();
          return;
        }

        if (key.name === "backspace") {
          if (value.length === 0) {
            beep(stdout);
            scheduleRender();
            return;
          }
          value = value.slice(0, -1);
          ghostSuffix = "";
          resetCycleState();
          await refreshGhost();
          return;
        }

        if (isPrintableInput(str, key)) {
          value += str;
          ghostSuffix = "";
          resetCycleState();
          await refreshGhost();
          return;
        }

        // Ignore unsupported keys for MVP (arrows/home/end/etc.).
        scheduleRender();
      })().catch((error) => {
        settleReject(error);
      });
    };

    const cleanup = (): void => {
      clearPendingEscapeAbort();
      escapeSequenceBuffer = "";
      options.stdin.off("keypress", keypressHandler as never);
      stdinWithRawMode.setRawMode(false);
      if (typeof options.stdin.pause === "function") {
        options.stdin.pause();
      }
      stdout.write("\x1b[?25h");
    };

    try {
      if (options.defaultHint && options.defaultHint.trim().length > 0) {
        const label = options.defaultHintLabel?.trim() || "Default path";
        stdout.write(`${dim(`${label}: ${options.defaultHint}`)}\n`);
      }
      emitKeypressEvents(options.stdin);
      if (typeof options.stdin.resume === "function") {
        options.stdin.resume();
      }
      stdinWithRawMode.setRawMode(true);
      stdout.write("\x1b[?25l");
      options.stdin.on("keypress", keypressHandler as never);
    } catch (error) {
      settleReject(error);
    }
  });
}
