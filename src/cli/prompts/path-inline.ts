import {
  beep,
  createInlinePromptRenderer,
  dim,
  supportsRawSessionIO,
  type RawSessionKeypressInfo,
} from "../tui";
import { runInlinePromptSession } from "./inline-session";
import type { PathPromptRuntimeConfig } from "./path-config";
import { styleCliDiagnosticLabel } from "../diagnostic-color";
import { resolveCliColorEnabled } from "../colors";
import {
  advanceSiblingPreview,
  acceptSiblingPreview,
  clearInteractionState,
  deriveGhostSuffixFromPreview,
  derivePreferredGhostSuffix,
  setCycleState,
  type SiblingPreviewDirection,
  type InlinePromptInteractionState,
} from "./path-inline-state";
import {
  deriveSiblingPreviewScopeKey,
  resolveSiblingPreviewCandidates,
} from "./path-sibling-preview";
import {
  resolvePathSuggestions,
  type PathSuggestion,
  type ResolvePathSuggestionsOptions,
} from "./path-suggestions";

type ValidationFn = (value: string) => true | string | Promise<true | string>;

type SuggestionFilter =
  | { targetKind: "any" | "directory"; fileExtensions?: string[] }
  | { targetKind: "any" | "directory"; fileExtensions?: undefined };

export interface InlinePathPromptOptions {
  message: string;
  cwd: string;
  kindLabel?: string;
  optional?: boolean;
  defaultHint?: string;
  defaultHintLabel?: string;
  runtimeConfig: PathPromptRuntimeConfig;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  signal?: AbortSignal;
  initialValue?: string;
  onChange?: (value: string) => void;
  colorEnabled?: boolean;
  validate: ValidationFn;
  suggestionFilter: SuggestionFilter;
  resolveSuggestions?: (options: ResolvePathSuggestionsOptions) => Promise<PathSuggestion[]>;
}

type KeypressInfo = RawSessionKeypressInfo;

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

export async function promptPathInlineGhost(options: InlinePathPromptOptions): Promise<string> {
  options.signal?.throwIfAborted();
  if (!supportsRawSessionIO(options.stdin, options.stdout)) {
    throw new Error("Inline path prompt requires TTY stdin/stdout with raw mode support");
  }

  const stdout = options.stdout;
  const resolveSuggestions = options.resolveSuggestions ?? resolvePathSuggestions;

  let value = options.initialValue ?? "";
  let ghostSuffix = "";
  let interactionState: InlinePromptInteractionState = clearInteractionState();
  let renderScheduled = false;
  let resolvingSuggestions = false;
  let needsRefreshAgain = false;
  let activeRefreshSeq = 0;
  let closed = false;
  const inlineRenderer = createInlinePromptRenderer(stdout);

  const render = (): void => {
    if (closed) {
      return;
    }
    inlineRenderer.render({
      prefixText: `${options.message} ${value}`,
      ghostText: ghostSuffix,
    });
  };

  const scheduleRender = (): void => {
    if (!closed) options.onChange?.(value);
    if (closed) {
      return;
    }
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
    if (closed) {
      return;
    }
    const refreshSeq = ++activeRefreshSeq;
    const previewGhostSuffix = derivePreferredGhostSuffix({
      value,
      state: interactionState,
    });
    if (previewGhostSuffix.length > 0) {
      ghostSuffix = previewGhostSuffix;
      return;
    }

    const suggestions = await resolveSuggestions({
      cwd: options.cwd,
      input: value,
      minChars: options.runtimeConfig.autocomplete.minChars,
      maxSuggestions: options.runtimeConfig.autocomplete.maxSuggestions,
      includeHidden: options.runtimeConfig.autocomplete.includeHidden,
      targetKind: options.suggestionFilter.targetKind,
      fileExtensions: options.suggestionFilter.fileExtensions,
    });

    if (closed || refreshSeq !== activeRefreshSeq) {
      return;
    }

    ghostSuffix = derivePreferredGhostSuffix({
      value,
      state: interactionState,
      fallbackReplacement: suggestions[0]?.replacement,
    });
  };

  const refreshGhost = async (): Promise<void> => {
    if (closed) {
      return;
    }
    if (resolvingSuggestions) {
      needsRefreshAgain = true;
      return;
    }

    resolvingSuggestions = true;
    try {
      await computeGhostSuffix();
    } finally {
      resolvingSuggestions = false;
    }

    if (closed || options.signal?.aborted) {
      return;
    }

    scheduleRender();
    if (needsRefreshAgain) {
      needsRefreshAgain = false;
      void refreshGhost();
    }
  };

  const startOrAdvanceCycle = async (): Promise<boolean> => {
    const cycleState = interactionState.cycleState;
    if (cycleState && cycleState.replacements.length > 0) {
      const nextIndex = (cycleState.index + 1) % cycleState.replacements.length;
      interactionState = setCycleState(interactionState, {
        ...cycleState,
        index: nextIndex,
      });
      value = cycleState.replacements[nextIndex] ?? value;
      ghostSuffix = "";
      scheduleRender();
      return true;
    }

    const suggestions = await resolveSuggestions({
      cwd: options.cwd,
      input: value,
      minChars: options.runtimeConfig.autocomplete.minChars,
      maxSuggestions: options.runtimeConfig.autocomplete.maxSuggestions,
      includeHidden: options.runtimeConfig.autocomplete.includeHidden,
      targetKind: options.suggestionFilter.targetKind,
      fileExtensions: options.suggestionFilter.fileExtensions,
    });

    const replacements = [...new Set(suggestions.map((item) => item.replacement))];
    if (closed || replacements.length === 0) {
      return false;
    }

    interactionState = setCycleState(interactionState, {
      replacements,
      index: 0,
    });
    value = replacements[0] ?? value;
    ghostSuffix = "";
    scheduleRender();
    return true;
  };

  const resetInteractionState = (): void => {
    interactionState = clearInteractionState();
  };

  const acceptGhostSuffix = async (): Promise<boolean> => {
    const previewAccepted = await acceptActiveSiblingPreview();
    if (previewAccepted) {
      return true;
    }

    if (closed || ghostSuffix.length === 0) {
      return false;
    }

    value += ghostSuffix;
    ghostSuffix = "";
    resetInteractionState();
    await refreshGhost();
    return true;
  };

  const acceptActiveSiblingPreview = async (): Promise<boolean> => {
    const siblingPreviewAcceptance = acceptSiblingPreview(value, interactionState);
    if (siblingPreviewAcceptance.accepted) {
      value = siblingPreviewAcceptance.nextValue;
      interactionState = siblingPreviewAcceptance.nextState;
      ghostSuffix = "";
      await refreshGhost();
      return true;
    }

    return false;
  };

  const moveToParentPathSegment = async (): Promise<boolean> => {
    const nextValue = moveToParentPathSegmentValue(value);
    if (nextValue == null || nextValue === value) {
      return false;
    }

    value = nextValue;
    ghostSuffix = "";
    resetInteractionState();
    await refreshGhost();
    return true;
  };

  const browseSiblingPreview = async (direction: SiblingPreviewDirection): Promise<boolean> => {
    const scopeKey = deriveSiblingPreviewScopeKey({
      cwd: options.cwd,
      input: value,
      includeHidden: options.runtimeConfig.autocomplete.includeHidden,
      maxSuggestions: options.runtimeConfig.autocomplete.maxSuggestions,
      targetKind: options.suggestionFilter.targetKind,
      fileExtensions: options.suggestionFilter.fileExtensions,
    });

    const cachedPreviewState = interactionState.siblingPreviewState;
    const candidates =
      cachedPreviewState?.scopeKey === scopeKey
        ? {
            scopeKey: cachedPreviewState.scopeKey,
            replacements: cachedPreviewState.replacements,
          }
        : await resolveSiblingPreviewCandidates({
            cwd: options.cwd,
            input: value,
            includeHidden: options.runtimeConfig.autocomplete.includeHidden,
            maxSuggestions: options.runtimeConfig.autocomplete.maxSuggestions,
            targetKind: options.suggestionFilter.targetKind,
            fileExtensions: options.suggestionFilter.fileExtensions,
          });

    if (closed) return false;
    const previewAdvance = advanceSiblingPreview(interactionState, candidates, direction);
    interactionState = previewAdvance.nextState;

    if (!previewAdvance.changed) {
      ghostSuffix = "";
      return false;
    }

    ghostSuffix = deriveGhostSuffixFromPreview(value, previewAdvance.previewReplacement);
    scheduleRender();
    return true;
  };

  await refreshGhost();
  options.signal?.throwIfAborted();
  scheduleRender();

  return await runInlinePromptSession(options, {
    beforeStart() {
      if (options.defaultHint && options.defaultHint.trim().length > 0) {
        const label = options.defaultHintLabel?.trim() || "Default path";
        stdout.write(`${dim(`${label}: ${options.defaultHint}`)}\n`);
      }
    },
    onClose(rejected) {
      closed = true;
      activeRefreshSeq += 1;
      if (rejected) options.onChange?.(value);
    },
    clear: inlineRenderer.clear,
    async onKey(parsed, submit) {
      if (parsed.kind === "arrow") {
        if (parsed.direction === "right") {
          const accepted = await acceptGhostSuffix();
          if (!closed && !accepted) {
            beep(stdout);
            scheduleRender();
          }
          return;
        }

        if (parsed.direction === "left") {
          const moved = await moveToParentPathSegment();
          if (!closed && !moved) {
            beep(stdout);
            scheduleRender();
          }
          return;
        }

        const navigated = await browseSiblingPreview(
          parsed.direction === "up" ? "previous" : "next",
        );
        if (!closed && !navigated) {
          beep(stdout);
          scheduleRender();
        }
        return;
      }

      const nextStr = parsed.str;
      const nextKey = parsed.key;

      if (nextKey.name === "return" || nextKey.name === "enter") {
        const validation = await options.validate(value);
        if (closed) return;
        if (validation === true) {
          submit(value);
          return;
        }
        inlineRenderer.clear();
        const label = styleCliDiagnosticLabel(
          { colorEnabled: options.colorEnabled ?? resolveCliColorEnabled() },
          stdout,
          "error",
          "Error:",
        );
        const message = validation.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ");
        stdout.write(`${label} ${message}\n`);
        scheduleRender();
        return;
      }

      if (nextKey.name === "tab") {
        const acceptedPreview = await acceptActiveSiblingPreview();
        if (acceptedPreview || closed) {
          return;
        }

        const cycled = await startOrAdvanceCycle();
        if (!closed && !cycled) {
          beep(stdout);
          scheduleRender();
        }
        return;
      }

      if (nextKey.ctrl && nextKey.name === "u") {
        value = "";
        ghostSuffix = "";
        resetInteractionState();
        await refreshGhost();
        return;
      }

      if (nextKey.name === "backspace") {
        if (value.length === 0) {
          beep(stdout);
          scheduleRender();
          return;
        }
        value = value.slice(0, -1);
        ghostSuffix = "";
        resetInteractionState();
        await refreshGhost();
        return;
      }

      if (isPrintableInput(nextStr, nextKey)) {
        value += nextStr;
        ghostSuffix = "";
        resetInteractionState();
        await refreshGhost();
        return;
      }

      // Ignore unsupported keys for MVP (arrows/home/end/etc.).
      scheduleRender();
    },
  });
}
