export const DEFAULT_LARGE_ROW_COUNT = 250;

export function createBasicRows() {
  return [
    { id: 1, name: "Ada", status: "active", created_at: "2026-03-01" },
    { id: 2, name: "Bob", status: "paused", created_at: "2026-03-02" },
    { id: 3, name: "Cyd", status: "draft", created_at: "2026-03-03" },
  ];
}

export function createWideRows() {
  return [
    {
      id: 1,
      status: "ok",
      message: "Short message for bounded preview checks",
      owner: "ada",
      region: "tw",
      environment: "staging",
      note: "This row is intentionally wide so the renderer has to hide columns.",
    },
  ];
}

export function createLargeRows(count) {
  const rows = [];
  for (let index = 1; index <= count; index += 1) {
    rows.push({
      id: index,
      group: `g${String(((index - 1) % 6) + 1).padStart(2, "0")}`,
      status: ["active", "paused", "draft"][index % 3],
      score: 1000 + index,
      note: `fixture-row-${String(index).padStart(4, "0")}`,
    });
  }
  return rows;
}
