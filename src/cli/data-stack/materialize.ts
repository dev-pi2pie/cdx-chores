import { stringifyDelimitedRows } from "../../utils/delimited";
import { CliError } from "../errors";
import type { DataStackOutputFormat } from "./types";

function assertUniqueJsonObjectKeys(header: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of header) {
    if (seen.has(key)) {
      throw new CliError(
        `JSON stack output requires unique column or key names. Duplicate name: ${key}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    seen.add(key);
  }
}

export function materializeDataStackRows(options: {
  format: DataStackOutputFormat;
  header: readonly string[];
  rows: ReadonlyArray<readonly unknown[]>;
}): string {
  if (options.format === "json") {
    assertUniqueJsonObjectKeys(options.header);
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
