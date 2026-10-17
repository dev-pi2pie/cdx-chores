const categories = new Set([
  "build",
  "comparison",
  "runner",
  "startup",
  "timeout",
  "cancellation",
  "output",
  "cleanup",
]);

export class HarnessError extends Error {
  constructor(category, stage = "validation", id) {
    super(`DOCX validation ${category}`);
    this.name = "HarnessError";
    this.category = categories.has(category) ? category : "runner";
    this.stage = stage;
    this.id = id;
  }
}

export function safeLabel(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 ,.;:()/+·–-]{0,159}$/.test(value))
    throw new HarnessError("output");
  return value;
}

export function safeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(value);
}
