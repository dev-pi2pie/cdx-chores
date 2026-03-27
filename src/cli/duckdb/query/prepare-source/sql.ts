import type { DataHeaderMappingEntry } from "../../header-mapping";
import { escapeSqlStringLiteral, quoteSqlIdentifier } from "../formats";
import type {
  DataQueryInputFormat,
  DataQuerySourceShape,
  ExcelImportMode,
  QueryRelationColumn,
} from "../types";

export function buildRelationSql(
  inputPath: string,
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape = {},
  options: {
    excelHeader?: boolean;
    excelImportMode?: ExcelImportMode;
  } = {},
): string {
  const escapedInput = escapeSqlStringLiteral(inputPath);
  switch (format) {
    case "csv":
      return `select * from read_csv_auto(${[
        escapedInput,
        "delim = ','",
        ...(shape.noHeader ? ["header = false"] : []),
      ].join(", ")})`;
    case "tsv":
      return `select * from read_csv_auto(${[
        escapedInput,
        "delim = '\t'",
        ...(shape.noHeader ? ["header = false"] : []),
      ].join(", ")})`;
    case "parquet":
      return `select * from read_parquet(${escapedInput})`;
    case "sqlite":
      return `select * from sqlite_scan(${escapedInput}, ${escapeSqlStringLiteral(shape.source ?? "")})`;
    case "excel":
      return `select * from read_xlsx(${[
        escapedInput,
        `sheet = ${escapeSqlStringLiteral(shape.source ?? "")}`,
        ...(shape.range ? [`range = ${escapeSqlStringLiteral(shape.range)}`] : []),
        ...(options.excelHeader ? ["header = true"] : []),
        ...(options.excelImportMode === "empty_as_varchar" ? ["empty_as_varchar = true"] : []),
        ...(options.excelImportMode === "all_varchar" ? ["all_varchar = true"] : []),
      ].join(", ")})`;
  }
}

export function buildPreparedFileProjectionSql(
  columns: readonly QueryRelationColumn[],
  headerMappings: readonly DataHeaderMappingEntry[],
  options: {
    excludeBlankRows?: boolean;
  } = {},
): string {
  const targetBySource = new Map(headerMappings.map((mapping) => [mapping.from, mapping.to]));
  const selectList =
    columns.length > 0
      ? columns
          .map((column) => {
            const renamedTarget = targetBySource.get(column.name);
            if (!renamedTarget) {
              if (column.sourceName === column.name) {
                return quoteSqlIdentifier(column.sourceName);
              }
              return `${quoteSqlIdentifier(column.sourceName)} as ${quoteSqlIdentifier(column.name)}`;
            }
            return `${quoteSqlIdentifier(column.sourceName)} as ${quoteSqlIdentifier(renamedTarget)}`;
          })
          .join(", ")
      : "*";
  const blankRowPredicate =
    options.excludeBlankRows && columns.length > 0
      ? columns
          .map(
            (column) =>
              `nullif(trim(cast(${quoteSqlIdentifier(column.sourceName)} as varchar)), '') is not null`,
          )
          .join(" or ")
      : undefined;
  return `select ${selectList} from file_source${blankRowPredicate ? ` where ${blankRowPredicate}` : ""}`;
}

export function buildExcelImportModes(isShapedExcel: boolean): ExcelImportMode[] {
  return isShapedExcel ? ["empty_as_varchar", "all_varchar"] : ["default"];
}
