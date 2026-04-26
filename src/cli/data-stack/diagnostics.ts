import { CliError } from "../errors";
import type {
  DataStackPlanCandidateUniqueKey,
  DataStackDuplicatePolicy,
  DataStackPlanDiagnostics,
} from "./plan";

export const DATA_STACK_DIAGNOSTICS_LIMITS = {
  candidateUniqueKeys: 12,
  columnSummaries: 48,
  enumLikeDistinctValues: 12,
  sampleValues: 5,
  twoColumnCandidateColumns: 12,
} as const;

export interface DataStackDuplicateSummary {
  duplicateKeyConflicts: number;
  exactDuplicateRows: number;
}

export interface DataStackDiagnosticsResult {
  columnSummaries: DataStackColumnSummary[];
  duplicateKeyNullRows: number;
  duplicateSummary: DataStackDuplicateSummary;
  planDiagnostics: DataStackPlanDiagnostics;
}

export interface DataStackColumnSummary {
  enumLikeValues: string[];
  index: number;
  name: string;
  nullRows: number;
  sampleValues: string[];
  uniqueValueCount: number;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => JSON.parse(stableStringify(item) || '""')));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, JSON.parse(stableStringify(record[key]) || '""')]),
      ),
    );
  }
  return JSON.stringify(value);
}

function normalizeDiagnosticValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return stableStringify(value);
  }
  return String(value);
}

function encodeDiagnosticTuple(values: readonly unknown[]): string {
  return JSON.stringify(values.map((value) => normalizeDiagnosticValue(value)));
}

function isNullKeyValue(value: unknown): boolean {
  return value === null || value === undefined || String(value).length === 0;
}

function countDuplicateRows(keys: readonly string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const key of keys) {
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
  }
  return duplicates;
}

function computeExactDuplicateRows(rows: ReadonlyArray<readonly unknown[]>): number {
  return countDuplicateRows(rows.map((row) => encodeDiagnosticTuple(row)));
}

function resolveColumnIndexes(header: readonly string[], names: readonly string[]): number[] {
  const indexesByName = new Map(header.map((name, index) => [name, index]));
  const unknownNames = names.filter((name) => !indexesByName.has(name));
  if (unknownNames.length > 0) {
    throw new CliError(`Unknown --unique-by names: ${unknownNames.join(", ")}.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return names.map((name) => indexesByName.get(name) as number);
}

function analyzeKeyColumns(
  rows: ReadonlyArray<readonly unknown[]>,
  indexes: readonly number[],
): { duplicateRows: number; nullRows: number } {
  const keys: string[] = [];
  let nullRows = 0;
  for (const row of rows) {
    const values = indexes.map((index) => row[index]);
    if (values.some(isNullKeyValue)) {
      nullRows += 1;
      continue;
    }
    keys.push(encodeDiagnosticTuple(values));
  }

  return {
    duplicateRows: countDuplicateRows(keys),
    nullRows,
  };
}

function computeColumnSummaries(options: {
  header: readonly string[];
  rows: ReadonlyArray<readonly unknown[]>;
}): DataStackColumnSummary[] {
  return options.header
    .slice(0, DATA_STACK_DIAGNOSTICS_LIMITS.columnSummaries)
    .map((name, index) => {
      const distinctValues = new Set<string>();
      const sampleValues: string[] = [];
      let nullRows = 0;

      for (const row of options.rows) {
        const value = row[index];
        if (isNullKeyValue(value)) {
          nullRows += 1;
          continue;
        }

        const normalized = normalizeDiagnosticValue(value);
        distinctValues.add(normalized);
        if (
          sampleValues.length < DATA_STACK_DIAGNOSTICS_LIMITS.sampleValues &&
          !sampleValues.includes(normalized)
        ) {
          sampleValues.push(normalized);
        }
      }

      const sortedValues = [...distinctValues].sort((left, right) => left.localeCompare(right));
      const enumLikeValues =
        sortedValues.length <= DATA_STACK_DIAGNOSTICS_LIMITS.enumLikeDistinctValues
          ? sortedValues
          : [];

      return {
        enumLikeValues,
        index,
        name,
        nullRows,
        sampleValues,
        uniqueValueCount: distinctValues.size,
      };
    });
}

function computeCandidateUniqueKeys(options: {
  header: readonly string[];
  rows: ReadonlyArray<readonly unknown[]>;
}): DataStackPlanCandidateUniqueKey[] {
  const candidates: DataStackPlanCandidateUniqueKey[] = [];

  for (const [index, name] of options.header.entries()) {
    const key = analyzeKeyColumns(options.rows, [index]);
    if (key.duplicateRows === 0 && key.nullRows === 0) {
      candidates.push({
        columns: [name],
        duplicateRows: key.duplicateRows,
        nullRows: key.nullRows,
      });
      if (candidates.length >= DATA_STACK_DIAGNOSTICS_LIMITS.candidateUniqueKeys) {
        return candidates;
      }
    }
  }

  const pairHeader = options.header.slice(
    0,
    DATA_STACK_DIAGNOSTICS_LIMITS.twoColumnCandidateColumns,
  );
  for (let left = 0; left < pairHeader.length; left += 1) {
    for (let right = left + 1; right < pairHeader.length; right += 1) {
      if (candidates.length >= DATA_STACK_DIAGNOSTICS_LIMITS.candidateUniqueKeys) {
        return candidates;
      }
      const key = analyzeKeyColumns(options.rows, [left, right]);
      if (key.duplicateRows === 0 && key.nullRows === 0) {
        candidates.push({
          columns: [pairHeader[left] as string, pairHeader[right] as string],
          duplicateRows: key.duplicateRows,
          nullRows: key.nullRows,
        });
      }
    }
  }

  return candidates.slice(0, DATA_STACK_DIAGNOSTICS_LIMITS.candidateUniqueKeys);
}

export function computeDataStackDiagnostics(options: {
  header: readonly string[];
  matchedFileCount: number;
  reportPath?: string | null;
  rows: ReadonlyArray<readonly unknown[]>;
  uniqueBy?: readonly string[];
}): DataStackDiagnosticsResult {
  const uniqueBy = options.uniqueBy ?? [];
  const keyIndexes = uniqueBy.length > 0 ? resolveColumnIndexes(options.header, uniqueBy) : [];
  const keySummary =
    keyIndexes.length > 0
      ? analyzeKeyColumns(options.rows, keyIndexes)
      : { duplicateRows: 0, nullRows: 0 };

  const columnSummaries = computeColumnSummaries({
    header: options.header,
    rows: options.rows,
  });

  return {
    columnSummaries,
    duplicateKeyNullRows: keySummary.nullRows,
    duplicateSummary: {
      duplicateKeyConflicts: keySummary.duplicateRows,
      exactDuplicateRows: computeExactDuplicateRows(options.rows),
    },
    planDiagnostics: {
      candidateUniqueKeys: computeCandidateUniqueKeys({
        header: options.header,
        rows: options.rows,
      }),
      matchedFileCount: options.matchedFileCount,
      reportPath: options.reportPath ?? null,
      rowCount: options.rows.length,
      schemaNameCount: options.header.length,
    },
  };
}

export function enforceDataStackDuplicatePolicy(options: {
  diagnostics: DataStackDiagnosticsResult;
  policy: DataStackDuplicatePolicy;
  uniqueBy: readonly string[];
  label?: string;
}): void {
  if (options.policy !== "reject") {
    return;
  }

  const prefix = options.label ? `${options.label} ` : "";
  if (options.uniqueBy.length > 0) {
    if (options.diagnostics.duplicateSummary.duplicateKeyConflicts > 0) {
      throw new CliError(
        `${prefix}duplicate key conflicts found for unique key ${options.uniqueBy.join(", ")}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    return;
  }

  if (options.diagnostics.duplicateSummary.exactDuplicateRows > 0) {
    throw new CliError(`${prefix}exact duplicate rows found.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}
