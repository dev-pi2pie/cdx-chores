import { stringifyDelimitedRows } from "../../utils/delimited";
import type { DataStackOutputFormat } from "./types";

export function materializeDataStackRows(options: {
  format: DataStackOutputFormat;
  header: readonly string[];
  rows: ReadonlyArray<readonly unknown[]>;
}): string {
  if (options.format === "json") {
    const records = options.rows.map((row) =>
      Object.fromEntries(options.header.map((header, index) => [header, row[index] ?? ""])),
    );
    return `${JSON.stringify(records)}\n`;
  }

  return stringifyDelimitedRows(
    [
      options.header,
      ...options.rows.map((row) =>
        options.header.map((_header, index) => {
          const value = row[index];
          if (value === null || value === undefined) {
            return "";
          }
          if (typeof value === "object") {
            return JSON.stringify(value);
          }
          return String(value);
        }),
      ),
    ],
    options.format,
  );
}
