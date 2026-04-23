import type { DelimitedFormat } from "../../utils/delimited";

export type DataStackInputFormat = DelimitedFormat;

export type DataStackOutputFormat = DelimitedFormat | "json";

export const DATA_STACK_INPUT_FORMAT_VALUES = ["csv", "tsv"] as const satisfies readonly DataStackInputFormat[];
