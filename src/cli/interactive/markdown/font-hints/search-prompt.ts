import type { input, select } from "@inquirer/prompts";
import type search from "@inquirer/search";
import { emitKeypressEvents } from "node:readline";

import type { CliRuntime } from "../../../types";

const FONT_HINT_SEARCH_ESCAPE_REASON = Symbol("font-hint-search-escape");

function isEscapeNavigation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortPromptError" &&
    error.cause === FONT_HINT_SEARCH_ESCAPE_REASON
  );
}

async function promptWithEscapeNavigation<T>(
  runtime: CliRuntime,
  sessionSignal: AbortSignal,
  runPrompt: (signal: AbortSignal) => Promise<T>,
): Promise<T | undefined> {
  const promptController = new AbortController();
  const cancelActivePrompt = () => promptController.abort(sessionSignal.reason);
  const navigateBack = (_input: string, key: { name?: string }) => {
    if (key.name === "escape") {
      promptController.abort(FONT_HINT_SEARCH_ESCAPE_REASON);
    }
  };

  emitKeypressEvents(runtime.stdin);
  runtime.stdin.on("keypress", navigateBack);
  sessionSignal.addEventListener("abort", cancelActivePrompt, { once: true });
  try {
    return await runPrompt(promptController.signal);
  } catch (error) {
    if (isEscapeNavigation(error)) {
      return undefined;
    }
    throw error;
  } finally {
    sessionSignal.removeEventListener("abort", cancelActivePrompt);
    runtime.stdin.removeListener("keypress", navigateBack);
  }
}

export async function promptMarkdownPdfInteractiveFontHintSearch(
  runtime: CliRuntime,
  searchPrompt: typeof search,
  config: Parameters<typeof search>[0],
  sessionSignal: AbortSignal,
): Promise<string | undefined> {
  const selected = await promptWithEscapeNavigation(runtime, sessionSignal, async (signal) => {
    return await searchPrompt(config, { input: runtime.stdin, output: runtime.stderr, signal });
  });
  if (selected === undefined) {
    return undefined;
  }
  if (typeof selected !== "string") {
    throw new TypeError("The font preference prompt returned a non-string value.");
  }
  return selected;
}

export async function promptMarkdownPdfInteractiveFontHintInput(
  runtime: CliRuntime,
  inputPrompt: typeof input,
  config: Parameters<typeof input>[0],
  sessionSignal: AbortSignal,
): Promise<string | undefined> {
  return await promptWithEscapeNavigation(runtime, sessionSignal, async (signal) => {
    return await inputPrompt(config, {
      input: runtime.stdin,
      output: runtime.stderr,
      signal,
    });
  });
}

export async function promptMarkdownPdfInteractiveFontHintSlowPath(
  runtime: CliRuntime,
  selectPrompt: typeof select,
  config: Parameters<typeof select>[0],
  sessionSignal: AbortSignal,
): Promise<"custom" | "wait" | undefined> {
  const selected = await promptWithEscapeNavigation(runtime, sessionSignal, async (signal) => {
    return await selectPrompt(config, {
      input: runtime.stdin,
      output: runtime.stderr,
      signal,
    });
  });
  if (selected === undefined || selected === "custom" || selected === "wait") {
    return selected;
  }
  throw new TypeError("The font discovery slow-path prompt returned an invalid choice.");
}
