import type { HarnessRunnerContext } from "../context";

export function createMiscActionMocks(context: HarnessRunnerContext) {
  return {
    actionDoctor: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("doctor", options);
    },
    actionDataPreview: async (
      _runtime: unknown,
      options: Record<string, unknown>,
    ) => {
      context.recordAction("data:preview", options);
    },
    actionDataParquetPreview: async (
      _runtime: unknown,
      options: Record<string, unknown>,
    ) => {
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
    actionJsonToCsv: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:json-to-csv", options);
    },
    actionJsonToTsv: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:json-to-tsv", options);
    },
    actionCsvToJson: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:csv-to-json", options);
    },
    actionCsvToTsv: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:csv-to-tsv", options);
    },
    actionTsvToCsv: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:tsv-to-csv", options);
    },
    actionTsvToJson: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("data:tsv-to-json", options);
    },
    actionMdToDocx: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("md:to-docx", options);
    },
    actionMdFrontmatterToJson: async (
      _runtime: unknown,
      options: Record<string, unknown>,
    ) => {
      context.recordAction("md:frontmatter-to-json", options);
    },
    actionVideoConvert: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("video:convert", options);
    },
    actionVideoResize: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("video:resize", options);
    },
    actionVideoGif: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("video:gif", options);
    },
  };
}
