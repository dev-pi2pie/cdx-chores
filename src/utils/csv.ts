import { delimitedRowsToObjects, parseDelimited, stringifyDelimitedRecords } from "./delimited";

type CsvRecord = Record<string, unknown>;

export function stringifyCsv(rows: CsvRecord[]): string {
  return stringifyDelimitedRecords(rows, "csv");
}

export function parseCsv(text: string): string[][] {
  return parseDelimited(text, "csv");
}

export function csvRowsToObjects(rows: string[][]): Array<Record<string, string>> {
  return delimitedRowsToObjects(rows);
}
