import { input } from "@inquirer/prompts";

import {
  beep,
  clearCurrentLine,
  createKeypressParser,
  dim,
  startRawSession,
  supportsRawSessionIO,
  type RawSession,
  type RawSessionKeypressInfo,
} from "../tui";
import type { PathPromptRuntimeConfig } from "./path-config";

type ValidationFn = (value: string) => true | string | Promise<true | string>;

export interface MultilineTextPromptResult {
  mode: "multiline" | "single-line-fallback";
  value: string;
}

export interface MultilineTextPromptOptions {
  message: string;
  debug?: boolean;
  debugStream?: NodeJS.WritableStream;
  runtimeConfig?: PathPromptRuntimeConfig;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WritableStream;
  validate: ValidationFn;
  promptImpls?: {
    simpleInput?: typeof input;
    advancedMultiline?: typeof promptTextMultiline;
  };
}

type KeypressInfo = RawSessionKeypressInfo;

function createPromptAbortError(): Error {
  const error = new Error("User aborted prompt");
  error.name = "ExitPromptError";
  return error;
}

function shouldUseAdvancedMultilinePrompt(options: MultilineTextPromptOptions): boolean {
  if (!options.runtimeConfig) {
    return false;
  }

  if (options.runtimeConfig.mode === "simple") {
    return false;
  }

  const stdoutWithTTY = options.stdout as (NodeJS.WritableStream & { isTTY?: boolean }) | undefined;
  return Boolean(options.stdin?.isTTY && stdoutWithTTY?.isTTY);
}

function isPrintableInput(str: string | undefined, key: KeypressInfo): boolean {
  if (typeof str !== "string") {
    return false;
  }
  if (str.length === 0) {
    return false;
  }
  if (key.ctrl || key.meta) {
    return false;
  }
  return key.name !== "return" && key.name !== "enter" && key.name !== "tab";
}

function moveCursorUp(stdout: NodeJS.WritableStream, count: number): void {
  if (count <= 0) {
    return;
  }
  stdout.write(`\x1b[${count}A`);
}

function clearRenderedBlock(stdout: NodeJS.WritableStream, lineCount: number): void {
  if (lineCount <= 0) {
    return;
  }

  clearCurrentLine(stdout);
  for (let index = 1; index < lineCount; index += 1) {
    moveCursorUp(stdout, 1);
    clearCurrentLine(stdout);
  }
}

function buildRenderedLines(message: string, value: string): string[] {
  const contentLines = value.split("\n");
  const visibleLines = contentLines.length > 0 ? contentLines : [""];
  const renderedValueLines =
    value.length > 0
      ? visibleLines.map((line, index) => `${index === 0 ? "> " : "  "}${line}`)
      : [`> ${dim("Type query intent")}`];

  return [
    message,
    dim("Press enter to submit, shift+enter for a new line"),
    ...renderedValueLines,
  ];
}

export async function promptMultilineTextWithFallback(
  options: MultilineTextPromptOptions,
): Promise<MultilineTextPromptResult> {
  if (shouldUseAdvancedMultilinePrompt(options)) {
    const advancedMultiline = options.promptImpls?.advancedMultiline ?? promptTextMultiline;
      return {
        mode: "multiline",
        value: await advancedMultiline({
          debug: options.debug,
          debugStream: options.debugStream,
          message: options.message,
          stdin: options.stdin!,
          stdout: options.stdout!,
        validate: options.validate,
      }),
    };
  }

  const simpleInput = options.promptImpls?.simpleInput ?? input;
  const value = await simpleInput({
    message: options.message,
    validate: options.validate,
  });
  return {
    mode: "single-line-fallback",
    value,
  };
}

export async function promptTextMultiline(options: {
  debug?: boolean;
  debugStream?: NodeJS.WritableStream;
  message: string;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  validate: ValidationFn;
}): Promise<string> {
  if (!supportsRawSessionIO(options.stdin, options.stdout)) {
    throw new Error("Multiline text prompt requires TTY stdin/stdout with raw mode support");
  }

  const stdout = options.stdout;
  let value = "";
  let closed = false;
  let renderScheduled = false;
  let renderedLineCount = 0;

  const render = (): void => {
    if (closed) {
      return;
    }

    clearRenderedBlock(stdout, renderedLineCount);
    const lines = buildRenderedLines(options.message, value);
    stdout.write(lines.join("\n"));
    renderedLineCount = lines.length;
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

  const debugStream = options.debugStream ?? stdout;
  const logRawChunkDebug = (chunk: string | Uint8Array): void => {
    if (!options.debug) {
      return;
    }

    const buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk);
    debugStream.write(
      `[multiline-raw] ${JSON.stringify({
        hex: buffer.toString("hex"),
        text: JSON.stringify(buffer.toString("utf8")),
      })}\n`,
    );
  };
  const logKeyDebug = (str: string, key: KeypressInfo): void => {
    if (!options.debug) {
      return;
    }
    debugStream.write(
      `[multiline-key] ${JSON.stringify({
        str,
        key: {
          ctrl: key.ctrl ?? false,
          meta: key.meta ?? false,
          name: key.name ?? null,
          sequence: key.sequence ?? null,
          shift: key.shift ?? false,
        },
      })}\n`,
    );
  };

  return await new Promise<string>((resolve, reject) => {
    let settled = false;
    let session: RawSession | undefined;
    let removeRawDataListener: (() => void) | undefined;
    const keyParser = createKeypressParser({
      onEscapeAbort: () => {
        settleReject(createPromptAbortError());
      },
    });

    const cleanup = (): void => {
      removeRawDataListener?.();
      removeRawDataListener = undefined;
      keyParser.dispose();
      session?.close();
    };

    const settleResolve = (result: string): void => {
      if (settled) {
        return;
      }
      settled = true;
      closed = true;
      cleanup();
      clearRenderedBlock(stdout, renderedLineCount);
      renderedLineCount = 0;
      stdout.write(`${options.message}\n${result}\n`);
      resolve(result);
    };

    const settleReject = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      closed = true;
      cleanup();
      clearRenderedBlock(stdout, renderedLineCount);
      renderedLineCount = 0;
      stdout.write("\n");
      reject(error);
    };

    const keypressHandler = (str: string, key: KeypressInfo = {}): void => {
      logKeyDebug(str, key);
      void (async () => {
        const parsed = keyParser.handle(str, key);
        if (parsed.kind === "incomplete") {
          return;
        }

        if (parsed.kind === "arrow") {
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

        if ((nextKey.name === "return" || nextKey.name === "enter") && nextKey.shift) {
          value += "\n";
          scheduleRender();
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
          if (!closed) {
            clearRenderedBlock(stdout, renderedLineCount);
          }
        },
      });
      if (options.debug && typeof options.stdin.on === "function" && typeof options.stdin.off === "function") {
        const rawDataHandler = (chunk: string | Uint8Array): void => {
          logRawChunkDebug(chunk);
        };
        options.stdin.on("data", rawDataHandler);
        removeRawDataListener = () => {
          options.stdin.off("data", rawDataHandler);
        };
      }
      session.addKeypressListener(keypressHandler);
    } catch (error) {
      settleReject(error);
    }
  });
}
