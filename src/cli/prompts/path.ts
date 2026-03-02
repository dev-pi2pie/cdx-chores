import { input, select } from "@inquirer/prompts";

import { defaultOutputPath, formatPathForDisplay, resolveFromCwd } from "../fs-utils";
import type { CliRuntime } from "../types";
import type { PathPromptRuntimeConfig } from "./path-config";
import { promptPathInlineGhost } from "./path-inline";

export type PathPromptKind = "path" | "file" | "directory" | "csv";

export interface PromptPathOptions {
  message: string;
  kind?: PathPromptKind;
  optional?: boolean;
  defaultValue?: string;
  defaultHint?: string;
  runtimeConfig?: PathPromptRuntimeConfig;
  cwd?: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WritableStream;
  promptImpls?: {
    simpleInput?: typeof input;
    advancedInline?: typeof promptPathInlineGhost;
  };
}

function formatPromptMessage(options: PromptPathOptions): string {
  if (options.defaultHint && options.defaultHint.trim().length > 0) {
    return `${options.message} (optional, default: ${options.defaultHint})`;
  }

  return options.message;
}

function formatInlinePromptMessage(options: PromptPathOptions): string {
  if ((options.optional ?? false) && options.defaultHint && options.defaultHint.trim().length > 0) {
    return `${options.message} (custom)`;
  }

  if (options.optional ?? false) {
    return `${options.message} (optional)`;
  }

  return options.message;
}

function formatInlineDefaultHintLabel(options: PromptPathOptions): string | undefined {
  if (!options.defaultHint || options.defaultHint.trim().length === 0) {
    return undefined;
  }

  return `${options.message} default (Enter to use)`;
}

function buildPathValidator(options: PromptPathOptions): (value: string) => true | string {
  return (value) => {
    if (options.optional ?? false) {
      return true;
    }
    return value.trim().length > 0 ? true : "Required";
  };
}

export async function promptPath(options: PromptPathOptions): Promise<string> {
  if (shouldUseAdvancedPathPrompt(options)) {
    return await promptPathAdvanced(options);
  }

  return await promptPathSimple(options);
}

function shouldUseAdvancedPathPrompt(options: PromptPathOptions): boolean {
  if (!options.runtimeConfig) {
    return false;
  }

  if (options.runtimeConfig.mode === "simple") {
    return false;
  }

  if (!options.runtimeConfig.autocomplete.enabled) {
    return false;
  }

  const hasCwd = typeof options.cwd === "string" && options.cwd.length > 0;
  const stdoutWithTTY = options.stdout as (NodeJS.WritableStream & { isTTY?: boolean }) | undefined;
  const hasTTYStreams = Boolean(options.stdin?.isTTY && stdoutWithTTY?.isTTY);
  return hasCwd && hasTTYStreams;
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

function pathKindToSuggestionFilter(
  kind: PathPromptKind | undefined,
): { targetKind: "any" | "directory"; fileExtensions?: string[] } {
  if (kind === "directory") {
    return { targetKind: "directory" };
  }

  if (kind === "csv") {
    return { targetKind: "any", fileExtensions: ["csv"] };
  }

  return { targetKind: "any" };
}

async function promptPathAdvanced(options: PromptPathOptions): Promise<string> {
  try {
    const filter = pathKindToSuggestionFilter(options.kind);
    const advancedInline = options.promptImpls?.advancedInline ?? promptPathInlineGhost;
    return await advancedInline({
      message: formatInlinePromptMessage(options),
      cwd: options.cwd!,
      optional: options.optional,
      defaultHint: options.defaultHint,
      defaultHintLabel: formatInlineDefaultHintLabel(options),
      runtimeConfig: options.runtimeConfig!,
      stdin: options.stdin!,
      stdout: options.stdout!,
      validate: buildPathValidator(options),
      suggestionFilter: filter,
    });
  } catch (error) {
    if (isPromptCancelError(error)) {
      throw error;
    }

    return await promptPathSimple(options);
  }
}

async function promptPathSimple(options: PromptPathOptions): Promise<string> {
  const simpleInput = options.promptImpls?.simpleInput ?? input;
  return await simpleInput({
    message: formatPromptMessage(options),
    default: options.defaultValue,
    validate: buildPathValidator(options),
  });
}

export async function promptRequiredPath(message: string, kind: PathPromptKind = "path"): Promise<string> {
  return await promptPath({ message, kind });
}

export async function promptOptionalPathWithHint(options: {
  message: string;
  defaultHint: string;
  kind?: PathPromptKind;
  runtimeConfig?: PathPromptRuntimeConfig;
  cwd?: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WritableStream;
}): Promise<string | undefined> {
  const value = await promptPath({
    message: options.message,
    kind: options.kind ?? "path",
    optional: true,
    defaultHint: options.defaultHint,
    runtimeConfig: options.runtimeConfig,
    cwd: options.cwd,
    stdin: options.stdin,
    stdout: options.stdout,
  });

  return value.trim().length > 0 ? value : undefined;
}

export async function promptOptionalOutputPathChoice(options: {
  message: string;
  defaultHint: string;
  kind?: PathPromptKind;
  runtimeConfig?: PathPromptRuntimeConfig;
  cwd?: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WritableStream;
  customMessage?: string;
}): Promise<string | undefined> {
  const choice = await select<"default" | "custom">({
    message: `${options.message} destination`,
    choices: [
      {
        name: "Use default output",
        value: "default",
        description: options.defaultHint,
      },
      {
        name: "Custom output path",
        value: "custom",
        description: "Type a custom path with inline completion",
      },
    ],
  });

  if (choice === "default") {
    return undefined;
  }

  return await promptRequiredPathWithConfig(options.customMessage ?? "Custom output path", {
    kind: options.kind ?? "file",
    runtimeConfig: options.runtimeConfig,
    cwd: options.cwd,
    stdin: options.stdin,
    stdout: options.stdout,
  });
}

export async function promptRequiredPathWithConfig(
  message: string,
  options: {
    kind?: PathPromptKind;
    runtimeConfig?: PathPromptRuntimeConfig;
    cwd?: string;
    stdin?: NodeJS.ReadStream;
    stdout?: NodeJS.WritableStream;
  } = {},
): Promise<string> {
  return await promptPath({
    message,
    kind: options.kind ?? "path",
    runtimeConfig: options.runtimeConfig,
    cwd: options.cwd,
    stdin: options.stdin,
    stdout: options.stdout,
  });
}

export function formatDefaultOutputPathHint(
  runtime: CliRuntime,
  inputPath: string,
  nextExtension: string,
): string {
  const derived = defaultOutputPath(inputPath, nextExtension);
  return formatPathForDisplay(runtime, resolveFromCwd(runtime, derived));
}
