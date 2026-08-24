import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";

export function createDataPreviewActionMocks(context: HarnessRunnerContext) {
  return {
    actionDataPreview: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:preview", options);
    },
    actionDataParquetPreview: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:parquet-preview", options);
    },
    loadDataPreviewSource: async (_runtime: unknown, input: unknown) => ({
      inputPath: String(input ?? ""),
      source: {
        columns: ["id", "name", "status", "region", "meta:key", "path"],
        format: String(input ?? "").endsWith(".json")
          ? "json"
          : String(input ?? "").endsWith(".tsv")
            ? "tsv"
            : "csv",
        totalRows: 3,
        getWindow: () => [],
      },
    }),
  };
}
