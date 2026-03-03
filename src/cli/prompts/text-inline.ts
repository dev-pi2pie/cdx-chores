import { input } from "@inquirer/prompts";

import {
  beep,
  clearCurrentLine,
  createKeypressParser,
  dim,
  moveCursorLeft,
  startRawSession,
  supportsRawSessionIO,
  type RawSession,
  type RawSessionKeypressInfo,
} from "../tui";
import type { PathPromptRuntimeConfig } from "./path-config";

type ValidationFn = (value: string) => true | string | Promise<true | string>;

export interface InlineTextPromptOptions {
  message: string;
  ghostText: string;
  runtimeConfig?: PathPromptRuntimeConfig;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WritableStream;
  validate: ValidationFn;
  promptImpls?: {
    simpleInput?: typeof input;
    advancedInline?: typeof promptTextInlineGhost;
  };
}

type KeypressInfo = RawSessionKeypressInfo;

function createPromptAbortError(): Error {
  const error = new Error("User aborted prompt");
  error.name = "ExitPromptError";
  return error;
}

function buildPromptLine(options: {
  message: string;
  value: string;
  ghostText: string;
}): { line: string; cursorBackCount: number } {
  const showGhost = options.value.length === 0 && options.ghostText.length > 0;
  const renderedGhost = showGhost ? dim(options.ghostText) : "";
  const line = `${options.message} ${options.value}${renderedGhost}`;
  return {
    line,
    cursorBackCount: showGhost ? options.ghostText.length : 0,
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

function isPromptCancelError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name.includes("exitprompt") ||
    name.includes("abort") ||
    message.includes("force closed") ||
    message.includes("user aborted")
  );
}

function shouldUseAdvancedTextPrompt(options: InlineTextPromptOptions): boolean {
  if (!options.runtimeConfig) {
    return false;
  }

  if (options.runtimeConfig.mode === "simple") {
    return false;
  }

  const stdoutWithTTY = options.stdout as (NodeJS.WritableStream & { isTTY?: boolean }) | undefined;
  return Boolean(options.stdin?.isTTY && stdoutWithTTY?.isTTY);
}

export async function promptTextWithGhost(options: InlineTextPromptOptions): Promise<string> {
  if (shouldUseAdvancedTextPrompt(options)) {
    try {
      const advancedInline = options.promptImpls?.advancedInline ?? promptTextInlineGhost;
      return await advancedInline({
        message: options.message,
        ghostText: options.ghostText,
        stdin: options.stdin!,
        stdout: options.stdout!,
        validate: options.validate,
      });
    } catch (error) {
      if (isPromptCancelError(error)) {
        throw error;
      }
    }
  }

  const simpleInput = options.promptImpls?.simpleInput ?? input;
  return await simpleInput({
    message: options.message,
    validate: options.validate,
  });
}

export async function promptTextInlineGhost(options: {
  message: string;
  ghostText: string;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  validate: ValidationFn;
}): Promise<string> {
  if (!supportsRawSessionIO(options.stdin, options.stdout)) {
    throw new Error("Inline text prompt requires TTY stdin/stdout with raw mode support");
  }

  const stdout = options.stdout;
  let value = "";
  let closed = false;
  let renderScheduled = false;

  const render = (): void => {
    if (closed) {
      return;
    }
    clearCurrentLine(stdout);
    const { line, cursorBackCount } = buildPromptLine({
      message: options.message,
      value,
      ghostText: options.ghostText,
    });
    stdout.write(line);
    moveCursorLeft(stdout, cursorBackCount);
  };

  const scheduleRender = (): void => {
    if (closed || renderScheduled) {
      return;
    }
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      render();
    });
  };

  scheduleRender();

  return await new Promise<string>((resolve, reject) => {
    let settled = false;
    let session: RawSession | undefined;
    const keyParser = createKeypressParser({
      onEscapeAbort: () => {
        settleReject(createPromptAbortError());
      },
    });

    const cleanup = (): void => {
      session?.close();
    };

    const settleResolve = (result: string): void => {
      if (settled) {
        return;
      }
      settled = true;
      closed = true;
      cleanup();
      clearCurrentLine(stdout);
      stdout.write(`${options.message} ${result}\n`);
      resolve(result);
    };

    const settleReject = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      closed = true;
      cleanup();
      clearCurrentLine(stdout);
      stdout.write("\n");
      reject(error);
    };

    const keypressHandler = (str: string, key: KeypressInfo = {}): void => {
      void (async () => {
        const parsed = keyParser.handle(str, key);

        if (parsed.kind === "incomplete") {
          return;
        }

        if (parsed.kind === "arrow") {
          if (parsed.direction === "right" && value.length === 0 && options.ghostText.length > 0) {
            value = options.ghostText;
            scheduleRender();
            return;
          }

          beep(stdout);
          scheduleRender();
          return;
        }

        const nextStr = parsed.str;
        const nextKey = parsed.key;

        if (nextKey.ctrl && nextKey.name === "c") {
          settleReject(createPromptAbortError());
          return;
        }

        if (nextKey.name === "return" || nextKey.name === "enter") {
          const validation = await options.validate(value);
          if (validation === true) {
            settleResolve(value);
            return;
          }
          beep(stdout);
          scheduleRender();
          return;
        }

        if (nextKey.ctrl && nextKey.name === "u") {
          value = "";
          scheduleRender();
          return;
        }

        if (nextKey.name === "backspace") {
          if (value.length === 0) {
            beep(stdout);
            scheduleRender();
            return;
          }
          value = value.slice(0, -1);
          scheduleRender();
          return;
        }

        if (isPrintableInput(nextStr, nextKey)) {
          value += nextStr;
          scheduleRender();
          return;
        }

        scheduleRender();
      })().catch((error) => {
        settleReject(error);
      });
    };

    try {
      session = startRawSession({
        stdin: options.stdin,
        stdout,
        onTeardown: () => {
          keyParser.dispose();
        },
      });
      session.addKeypressListener(keypressHandler);
    } catch (error) {
      settleReject(error);
    }
  });
}
