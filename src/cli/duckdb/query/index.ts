export {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  type DataQueryInputFormat,
  type DataQueryIntrospectionColumn,
  type DataQueryResultSet,
  type DataQuerySourceIntrospection,
  type DataQuerySourceShape,
  type DataQueryTableResult,
} from "./types";

export {
  normalizeExcelRange,
  normalizeExcelHeaderRow,
  normalizeExcelBodyStartRow,
} from "./excel-range";

export { quoteSqlIdentifier, detectDataQueryInputFormat, createDuckDbConnection } from "./formats";

export { listDataQuerySources } from "./source-resolution";

export { prepareDataQuerySource } from "./prepare-source";

export { executeDataQueryForTable, executeDataQueryForAllRows } from "./execute";

export { collectDataQuerySourceIntrospection, inspectDataQueryExtensions } from "./introspection";
