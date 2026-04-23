import type { DelimitedFormat } from "../../utils/delimited";

export type DataStackDelimitedInputFormat = DelimitedFormat;

export type DataStackInputFormat = DataStackDelimitedInputFormat | "jsonl";

export type DataStackOutputFormat = DelimitedFormat | "json";

export const DATA_STACK_INPUT_FORMAT_VALUES = [
  "csv",
  "tsv",
  "jsonl",
] as const satisfies readonly DataStackInputFormat[];

export const DATA_STACK_INTERACTIVE_INPUT_FORMAT_VALUES = [
  "csv",
  "tsv",
] as const satisfies readonly DataStackDelimitedInputFormat[];
