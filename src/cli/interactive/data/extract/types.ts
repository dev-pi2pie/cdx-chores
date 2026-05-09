import type { reviewInteractiveHeaderMappings } from "../../data-query";

export type InteractiveExtractOutputFormat = "csv" | "tsv" | "json";

export interface InteractiveExtractWritePlan {
  output: string;
  overwrite: boolean;
  outputFormat: InteractiveExtractOutputFormat;
}

export interface InteractiveExtractSessionState {
  headerMappingCount: number;
  headerMappings?: Awaited<ReturnType<typeof reviewInteractiveHeaderMappings>>["headerMappings"];
  selectedBodyStartRow?: number;
  selectedHeaderRow?: number;
  selectedNoHeader?: boolean;
  selectedRange?: string;
  selectedSource?: string;
}

export type InteractiveExtractReviewOutcome = "continue" | "revise" | "cancel";
export type InteractiveExtractWriteOutcome =
  | { kind: "confirm"; plan: InteractiveExtractWritePlan }
  | { kind: "review" }
  | { kind: "cancel" };
export type InteractiveExtractCheckpointOutcome =
  | { kind: "restart-setup" }
  | { kind: "cancel" }
  | { kind: "execute"; plan: InteractiveExtractWritePlan };

export const EXTRACT_CONTINUATION_LABELS = {
  continuationLabel: "extraction",
  notWritingLabel: "output yet",
  reviewPromptLabel: "extraction",
} as const;
