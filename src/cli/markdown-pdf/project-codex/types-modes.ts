export type MarkdownPdfProjectCodexSignalMode =
  | "too-low-signal"
  | "deterministic"
  | "codex-assisted";

export type MarkdownPdfProjectCodexProceedingSignalMode = Exclude<
  MarkdownPdfProjectCodexSignalMode,
  "too-low-signal"
>;

export type MarkdownPdfProjectCodexDecisionMode =
  | "deterministic"
  | "adapted"
  | "conservative-fallback"
  | "no-usable-project";

export type MarkdownPdfProjectCodexPhaseName = "profile" | "template";
