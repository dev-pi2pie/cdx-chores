import type { DataQuerySourceIntrospection } from "../../../duckdb/query";

export function describeSuspiciousExcelIntrospection(
  introspection: DataQuerySourceIntrospection,
  options: {
    mergedRangeCount?: number;
    usedRange?: string;
  } = {},
): string[] | undefined {
  const reasons: string[] = [];
  const generatedColumns = introspection.columns
    .map((column) => column.name)
    .filter((name) => /^column_\d+$/i.test(name));

  if (introspection.columns.length === 1 && introspection.sampleRows.length === 0) {
    reasons.push("Whole-sheet inspection found one visible column and no usable sample rows.");
  }

  if (generatedColumns.length >= 2 && introspection.sampleRows.length > 0) {
    const generatedCellValues = introspection.sampleRows.flatMap((row) =>
      generatedColumns.map((column) => row[column] ?? ""),
    );
    const blankGeneratedCells = generatedCellValues.filter(
      (value) => value.trim().length === 0,
    ).length;
    if (
      generatedColumns.length >= Math.ceil(introspection.columns.length / 2) &&
      blankGeneratedCells / generatedCellValues.length >= 0.7
    ) {
      reasons.push(
        "Whole-sheet inspection produced many generated placeholder columns with mostly blank sample cells.",
      );
    }
  }

  if (
    introspection.columns.length === 1 &&
    introspection.sampleRows.length > 0 &&
    (options.mergedRangeCount ?? 0) > 0
  ) {
    const onlyColumnName = introspection.columns[0]?.name ?? "";
    const match =
      typeof options.usedRange === "string" &&
      /^[A-Z]+[1-9][0-9]*:[A-Z]+[1-9][0-9]*$/i.test(options.usedRange)
        ? /^([A-Z]+)[1-9][0-9]*:([A-Z]+)[1-9][0-9]*$/i.exec(options.usedRange)
        : undefined;
    const startColumn = (match?.[1] ?? "").toUpperCase();
    const endColumn = (match?.[2] ?? "").toUpperCase();
    const hasWideUsedRange = Boolean(startColumn && endColumn && startColumn !== endColumn);
    const hasTitleLikeSingleColumnHeader =
      onlyColumnName.length >= 16 && /[_\s]/.test(onlyColumnName);
    if (hasWideUsedRange || hasTitleLikeSingleColumnHeader) {
      reasons.push(
        "Whole-sheet inspection collapsed a merged or multi-column worksheet into one visible column.",
      );
    }
  }

  return reasons.length > 0 ? reasons : undefined;
}
