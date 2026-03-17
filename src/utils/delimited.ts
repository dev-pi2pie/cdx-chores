import Papa from "papaparse";

type DelimitedRecord = Record<string, unknown>;

export type DelimitedFormat = "csv" | "tsv";

const DELIMITED_SEPARATOR: Record<DelimitedFormat, string> = {
  csv: ",",
  tsv: "\t",
};

function normalizeHeader(value: string, index: number): string {
  return (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim();
}

function withTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function getDelimitedSeparator(format: DelimitedFormat): string {
  return DELIMITED_SEPARATOR[format];
}

function getDelimitedLabel(format: DelimitedFormat): string {
  return format.toUpperCase();
}

export function stringifyDelimitedRecords(rows: DelimitedRecord[], format: DelimitedFormat): string {
  if (rows.length === 0) {
    return "";
  }

  const text = Papa.unparse(rows, {
    delimiter: getDelimitedSeparator(format),
    header: true,
    newline: "\n",
  });
  return withTrailingNewline(text);
}

export function stringifyDelimitedRows(rows: readonly (readonly unknown[])[], format: DelimitedFormat): string {
  if (rows.length === 0) {
    return "";
  }

  const text = Papa.unparse(rows, {
    delimiter: getDelimitedSeparator(format),
    header: false,
    newline: "\n",
  });
  return withTrailingNewline(text);
}

export function parseDelimited(text: string, format: DelimitedFormat): string[][] {
  const parsed = Papa.parse<string[]>(text, {
    delimiter: getDelimitedSeparator(format),
    header: false,
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    if (!first) {
      throw new Error(`${getDelimitedLabel(format)} parse error`);
    }
    throw new Error(
      `${getDelimitedLabel(format)} parse error at row ${first.row ?? "unknown"}: ${first.message}`,
    );
  }

  return parsed.data.map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))) : [],
  );
}

export function delimitedRowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) {
    return [];
  }
  const headers = headerRow.map((header, index) => normalizeHeader(header, index));

  return dataRows
    .filter((row) => row.some((value) => value.length > 0))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (header.length === 0) {
          return;
        }
        record[header] = row[index] ?? "";
      });
      return record;
    });
}
