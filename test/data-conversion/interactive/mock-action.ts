import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";

export function createDataConversionActionMocks(context: HarnessRunnerContext) {
  return {
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
  };
}
