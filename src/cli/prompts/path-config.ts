export type PathPromptMode = "auto" | "simple";

export interface PathPromptAutocompleteConfig {
  enabled: boolean;
  minChars: number;
  maxSuggestions: number;
  includeHidden: boolean;
}

export interface PathPromptRuntimeConfig {
  mode: PathPromptMode;
  autocomplete: PathPromptAutocompleteConfig;
}

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (value == null || value.trim().length === 0) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return defaultValue;
  }

  return parsed;
}

export function resolvePathPromptRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): PathPromptRuntimeConfig {
  const requestedMode = env.CDX_CHORES_PATH_PROMPT_MODE?.trim().toLowerCase();
  const mode: PathPromptMode = requestedMode === "simple" ? "simple" : "auto";

  const disableAutocomplete = parseBooleanFlag(env.CDX_CHORES_DISABLE_PATH_AUTOCOMPLETE, false);

  return {
    mode,
    autocomplete: {
      enabled: !disableAutocomplete,
      minChars: parsePositiveInt(env.CDX_CHORES_PATH_AUTOCOMPLETE_MIN_CHARS, 1),
      maxSuggestions: parsePositiveInt(env.CDX_CHORES_PATH_AUTOCOMPLETE_MAX_SUGGESTIONS, 12),
      includeHidden: parseBooleanFlag(env.CDX_CHORES_PATH_AUTOCOMPLETE_INCLUDE_HIDDEN, false),
    },
  };
}

