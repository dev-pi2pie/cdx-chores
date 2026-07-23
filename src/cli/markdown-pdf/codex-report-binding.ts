export type MarkdownPdfCodexReportBinding =
  | { kind: "none" }
  | { kind: "with-artifact" }
  | { kind: "external"; path: string };
