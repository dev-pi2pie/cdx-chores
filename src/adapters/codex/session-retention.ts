import type { CodexSessionRetention } from "../../utils/codex-session-retention";

type RetentionRequest = (
  method: "thread/archive" | "thread/delete",
  params: { threadId: string },
) => Promise<unknown>;

export type CodexSessionRetentionResult =
  | { status: "kept" | "archived" | "deleted"; threadId?: string }
  | { status: "failed" | "skipped"; threadId?: string; error: string };

export async function applyCodexSessionRetention(options: {
  mode: CodexSessionRetention;
  threadId?: string | null;
  completed: boolean;
  request: RetentionRequest;
}): Promise<CodexSessionRetentionResult> {
  const { mode, threadId, completed, request } = options;
  const identity = threadId ? { threadId } : {};
  if (mode === "keep") return { status: "kept", ...identity };
  if (!threadId) return { status: "skipped", error: "Thread ownership could not be confirmed." };
  if (!completed) {
    return { status: "skipped", threadId, error: "Turn completion could not be confirmed." };
  }

  try {
    await request(mode === "archive" ? "thread/archive" : "thread/delete", { threadId });
    return { status: mode === "archive" ? "archived" : "deleted", threadId };
  } catch (error) {
    return {
      status: "failed",
      threadId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
