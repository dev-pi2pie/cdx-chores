import type { CliRuntime } from "../types";
import {
  getInteractiveAbortNotice,
  isInteractiveTipSlotAvailable,
  writeInteractiveTip,
} from "./notice";

export type InteractiveFlowTipScope = "data-query" | "data-extract" | "data-stack";

const INTERACTIVE_FLOW_STATIC_TIPS: Record<InteractiveFlowTipScope, readonly string[]> = {
  "data-query": [
    "Manual is best for joins or custom SQL.",
    "SQL limit and preview rows are separate controls.",
    "Rows to show only affects terminal preview.",
  ],
  "data-extract": [
    "Source interpretation is reviewed before output setup.",
    "Change destination keeps the current extraction setup.",
  ],
  "data-stack": [
    "Pattern filtering only affects files discovered from the input directory.",
    "Review matched files before writing the stacked output.",
  ],
};

export function getInteractiveFlowStaticTips(scope: InteractiveFlowTipScope): readonly string[] {
  return INTERACTIVE_FLOW_STATIC_TIPS[scope];
}

export function buildInteractiveFlowTipPool(
  scope: InteractiveFlowTipScope,
  abortTip: string,
): string[] {
  return [abortTip, ...getInteractiveFlowStaticTips(scope)];
}

export function pickInteractiveFlowTip<T>(
  tips: readonly T[],
  selectionValue: number,
): T | undefined {
  if (tips.length === 0) {
    return undefined;
  }
  const normalized = Number.isFinite(selectionValue)
    ? Math.min(0.999999999, Math.max(0, selectionValue))
    : 0;
  return tips[Math.floor(normalized * tips.length)];
}

export function resolveInteractiveFlowTipSelectionValue(runtime: CliRuntime): number {
  return runtime.now().getUTCMilliseconds() / 1000;
}

export function getInteractiveFlowTip(
  runtime: CliRuntime,
  scope: InteractiveFlowTipScope,
  selectionValue = resolveInteractiveFlowTipSelectionValue(runtime),
): string | undefined {
  if (!isInteractiveTipSlotAvailable(runtime)) {
    return undefined;
  }
  const abortTip = getInteractiveAbortNotice(runtime) ?? "Press Ctrl+C to abort this session.";
  return pickInteractiveFlowTip(buildInteractiveFlowTipPool(scope, abortTip), selectionValue);
}

export function writeInteractiveFlowTip(
  runtime: CliRuntime,
  scope: InteractiveFlowTipScope,
  selectionValue = resolveInteractiveFlowTipSelectionValue(runtime),
): void {
  const tip = getInteractiveFlowTip(runtime, scope, selectionValue);
  if (tip) {
    writeInteractiveTip(runtime, tip);
  }
}
