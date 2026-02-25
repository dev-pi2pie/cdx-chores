import Papa from "papaparse";

type CsvRecord = Record<string, unknown>;

function normalizeHeader(value: string, index: number): string {
  return (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim();
}

export function stringifyCsv(rows: CsvRecord[]): string {
  if (rows.length === 0) {
    return "";
  }

  const csv = Papa.unparse(rows, {
    header: true,
    newline: "\n",
  });
  return csv.endsWith("\n") ? csv : `${csv}\n`;
}

export function parseCsv(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    delimiter: ",",
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    if (!first) {
      throw new Error("CSV parse error");
    }
    throw new Error(`CSV parse error at row ${first.row ?? "unknown"}: ${first.message}`);
  }

  return parsed.data.map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))) : [],
  );
}

export function csvRowsToObjects(rows: string[][]): Array<Record<string, string>> {
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
