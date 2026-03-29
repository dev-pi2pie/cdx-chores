import { input } from "@inquirer/prompts";

import {
  beep,
  createKeypressParser,
  createInlinePromptRenderer,
  dim,
  startRawSession,
  supportsRawSessionIO,
  type RawSession,
  type RawSessionKeypressInfo,
} from "../tui";
import type { PathPromptRuntimeConfig } from "./path-config";
import {
  deriveTemplateGhostSuffix,
  resolveTemplateCompletionMatch,
  type TemplateCompletionMatch,
} from "./text-template-candidates";

type ValidationFn = (value: string) => true | string | Promise<true | string>;

export interface InlineTextPromptOptions {
  message: string;
  helpLines?: string[];
  ghostHintLabel?: string;
  ghostText: string;
  completionKind?: "none" | "rename-template";
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
        helpLines: options.helpLines,
        ghostHintLabel: options.ghostHintLabel,
        ghostText: options.ghostText,
        completionKind: options.completionKind,
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
  if (options.helpLines && options.helpLines.length > 0 && options.stdout) {
    options.stdout.write(`${options.helpLines.join("\n")}\n`);
  }
  if (options.ghostHintLabel && options.ghostText.length > 0 && options.stdout) {
    options.stdout.write(`${dim(`${options.ghostHintLabel}: ${options.ghostText}`)}\n`);
  }
  return await simpleInput({
    message: options.message,
    validate: options.validate,
  });
}

export async function promptTextInlineGhost(options: {
  message: string;
  helpLines?: string[];
  ghostHintLabel?: string;
  ghostText: string;
  completionKind?: "none" | "rename-template";
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  validate: ValidationFn;
}): Promise<string> {
  if (!supportsRawSessionIO(options.stdin, options.stdout)) {
    throw new Error("Inline text prompt requires TTY stdin/stdout with raw mode support");
  }

  const stdout = options.stdout;
  let value = "";
  let ghostText = "";
  let closed = false;
  let renderScheduled = false;
  const inlineRenderer = createInlinePromptRenderer(stdout);
  let templateCompletion: TemplateCompletionMatch | undefined;
  let templateCycleState:
    | {
        index: number;
        scopeKey: string;
      }
    | undefined;

  const refreshGhostText = (): void => {
    templateCompletion = undefined;
    if (options.completionKind === "rename-template") {
      templateCompletion = resolveTemplateCompletionMatch(value);
      if (!templateCompletion) {
        ghostText = "";
        templateCycleState = undefined;
        return;
      }

      if (templateCycleState?.scopeKey !== templateCompletion.scopeKey) {
        templateCycleState = undefined;
      }

      const candidateIndex = templateCycleState?.index ?? 0;
      const candidate = templateCompletion.candidates[candidateIndex];
      ghostText =
        typeof candidate === "string"
          ? deriveTemplateGhostSuffix(templateCompletion.fragment, candidate)
          : "";
      return;
    }

    ghostText = value.length === 0 ? options.ghostText : "";
  };

  const render = (): void => {
    if (closed) {
      return;
    }
    inlineRenderer.render({
      prefixText: `${options.message} ${value}`,
      ghostText,
    });
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

  if (options.helpLines && options.helpLines.length > 0) {
    stdout.write(`${options.helpLines.join("\n")}\n`);
  }
  if (options.ghostHintLabel && options.ghostText.length > 0) {
    stdout.write(`${dim(`${options.ghostHintLabel}: ${options.ghostText}`)}\n`);
  }

  refreshGhostText();
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
      inlineRenderer.clear();
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
      inlineRenderer.clear();
      stdout.write("\n");
      reject(error);
    };

    const keypressHandler = (str: string, key: KeypressInfo = {}): void => {
      void (async () => {
        const parsed = keyParser.handle(str, key);

        if (parsed.kind === "incomplete") {
          return;
        }

        const acceptGhostText = (): boolean => {
          if (ghostText.length === 0) {
            return false;
          }
          value += ghostText;
          templateCycleState = undefined;
          refreshGhostText();
          scheduleRender();
          return true;
        };

        const cycleTemplateCandidates = (direction: "up" | "down"): boolean => {
          if (options.completionKind !== "rename-template") {
            return false;
          }
          const completion = resolveTemplateCompletionMatch(value);
          if (!completion || completion.candidates.length <= 1) {
            return false;
          }

          const currentIndex =
            templateCycleState?.scopeKey === completion.scopeKey ? templateCycleState.index : 0;
          const delta = direction === "down" ? 1 : -1;
          const nextIndex =
            (currentIndex + delta + completion.candidates.length) % completion.candidates.length;
          templateCycleState = {
            scopeKey: completion.scopeKey,
            index: nextIndex,
          };
          refreshGhostText();
          scheduleRender();
          return true;
        };

        if (parsed.kind === "arrow") {
          if (parsed.direction === "right" && acceptGhostText()) {
            return;
          }

          if (
            (parsed.direction === "up" || parsed.direction === "down") &&
            cycleTemplateCandidates(parsed.direction)
          ) {
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
          templateCycleState = undefined;
          refreshGhostText();
          scheduleRender();
          return;
        }

        if (nextKey.name === "tab") {
          if (acceptGhostText()) {
            return;
          }
          beep(stdout);
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
          templateCycleState = undefined;
          refreshGhostText();
          scheduleRender();
          return;
        }

        if (isPrintableInput(nextStr, nextKey)) {
          value += nextStr;
          templateCycleState = undefined;
          refreshGhostText();
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
