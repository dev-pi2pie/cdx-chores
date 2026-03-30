import type { CliRuntime } from "../types";
import { writeInteractiveTip } from "./notice";

export type InteractiveContextualTipId =
  | "data-query:mode-selection"
  | "data-query:sql-review"
  | "data-query:output-selection"
  | "data-extract:review"
  | "data-extract:write-boundary";

const INTERACTIVE_CONTEXTUAL_TIP_TEXT: Record<InteractiveContextualTipId, string> = {
  "data-query:mode-selection": "Manual is best for joins or custom SQL.",
  "data-query:sql-review": "SQL limit and preview rows are separate controls.",
  "data-query:output-selection": "Rows to show only affects terminal preview.",
  "data-extract:review": "Source interpretation is reviewed before output setup.",
  "data-extract:write-boundary": "Change destination keeps the current extraction setup.",
};

export function getInteractiveContextualTip(
  tipId: InteractiveContextualTipId,
): string {
  return INTERACTIVE_CONTEXTUAL_TIP_TEXT[tipId];
}

export function writeInteractiveContextualTip(
  runtime: CliRuntime,
  tipId: InteractiveContextualTipId,
): void {
  writeInteractiveTip(runtime, getInteractiveContextualTip(tipId));
}
