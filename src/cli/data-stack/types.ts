import type { DelimitedFormat } from "../../utils/delimited";

export type DataStackDelimitedInputFormat = DelimitedFormat;

export type DataStackInputFormat = DataStackDelimitedInputFormat | "json" | "jsonl";

export type DataStackOutputFormat = DelimitedFormat | "json";

export type DataStackSchemaMode = "strict" | "union-by-name";

export const DATA_STACK_INPUT_FORMAT_VALUES = [
  "csv",
  "tsv",
  "json",
  "jsonl",
] as const satisfies readonly DataStackInputFormat[];

export const DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES = [
  "csv",
  "tsv",
  "json",
  "jsonl",
] as const satisfies readonly DataStackInputFormat[];
