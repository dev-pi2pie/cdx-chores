const SESSION_RETENTION_MODES = ["keep", "archive", "delete"] as const;

export type CodexSessionRetention = (typeof SESSION_RETENTION_MODES)[number];

export function resolveCodexSessionRetention(value: unknown): CodexSessionRetention {
  if (value === undefined) return "keep";
  const mode = SESSION_RETENTION_MODES.find((option) => option === value);
  if (mode === undefined) {
    throw new TypeError(`Session retention must be one of: ${SESSION_RETENTION_MODES.join(", ")}.`);
  }
  return mode;
}
