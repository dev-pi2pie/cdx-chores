export interface CycleState {
  replacements: string[];
  index: number;
}

export interface SiblingPreviewState {
  scopeKey: string;
  replacements: string[];
  activeIndex: number;
}

export interface InlinePromptInteractionState {
  cycleState?: CycleState;
  siblingPreviewState?: SiblingPreviewState;
}

export function clearInteractionState(): InlinePromptInteractionState {
  return {};
}

export function clearCycleState(
  state: InlinePromptInteractionState,
): InlinePromptInteractionState {
  if (!state.cycleState) {
    return state;
  }

  return {
    ...state,
    cycleState: undefined,
  };
}

export function clearSiblingPreviewState(
  state: InlinePromptInteractionState,
): InlinePromptInteractionState {
  if (!state.siblingPreviewState) {
    return state;
  }

  return {
    ...state,
    siblingPreviewState: undefined,
  };
}

export function setCycleState(
  state: InlinePromptInteractionState,
  cycleState: CycleState | undefined,
): InlinePromptInteractionState {
  if (!cycleState) {
    return clearCycleState(state);
  }

  return {
    cycleState,
    siblingPreviewState: undefined,
  };
}

export function enterSiblingPreviewState(
  state: InlinePromptInteractionState,
  siblingPreviewState: SiblingPreviewState | undefined,
): InlinePromptInteractionState {
  if (!siblingPreviewState) {
    return clearSiblingPreviewState(clearCycleState(state));
  }

  return {
    cycleState: undefined,
    siblingPreviewState,
  };
}

export function getActiveSiblingPreviewReplacement(
  state: InlinePromptInteractionState,
): string | undefined {
  const siblingPreviewState = state.siblingPreviewState;
  if (!siblingPreviewState) {
    return undefined;
  }

  return siblingPreviewState.replacements[siblingPreviewState.activeIndex];
}

export function deriveGhostSuffixFromPreview(
  value: string,
  previewReplacement: string | undefined,
): string {
  if (
    !previewReplacement ||
    !previewReplacement.startsWith(value) ||
    previewReplacement.length <= value.length
  ) {
    return "";
  }

  return previewReplacement.slice(value.length);
}

export function acceptSiblingPreview(
  value: string,
  state: InlinePromptInteractionState,
): {
  accepted: boolean;
  nextState: InlinePromptInteractionState;
  nextValue: string;
} {
  const previewReplacement = getActiveSiblingPreviewReplacement(state);
  if (!previewReplacement) {
    return {
      accepted: false,
      nextState: state,
      nextValue: value,
    };
  }

  return {
    accepted: true,
    nextState: clearInteractionState(),
    nextValue: previewReplacement,
  };
}
