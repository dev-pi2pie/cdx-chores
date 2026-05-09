export interface DataQueryCodexDraft {
  reasoningSummary: string;
  sql: string;
}

export interface DataQueryCodexDraftResult {
  draft?: DataQueryCodexDraft;
  errorMessage?: string;
}

export function parseDataQueryCodexDraft(finalResponse: string): DataQueryCodexDraft {
  const parsed = JSON.parse(finalResponse) as {
    reasoning_summary?: unknown;
    sql?: unknown;
  };

  const sql = typeof parsed.sql === "string" ? parsed.sql.trim() : "";
  if (!sql) {
    throw new Error("Codex drafting response did not include SQL.");
  }

  const reasoningSummary =
    typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary.trim() : "";
  if (!reasoningSummary) {
    throw new Error("Codex drafting response did not include reasoning_summary.");
  }

  return {
    reasoningSummary,
    sql,
  };
}
