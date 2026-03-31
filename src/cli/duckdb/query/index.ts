export {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  type DataQueryInputFormat,
  type DataQueryIntrospectionColumn,
  type DataQueryRelationBinding,
  type DataQueryResultSet,
  type PreparedDataQueryContext,
  type DataQuerySourceIntrospection,
  type DataQuerySourceShape,
  type DataQueryTableResult,
  type DataQueryWorkspaceIntrospection,
  type DataQueryWorkspaceRelationIntrospection,
} from "./types";

export {
  normalizeExcelRange,
  normalizeExcelHeaderRow,
  normalizeExcelBodyStartRow,
} from "./excel-range";

export { quoteSqlIdentifier, detectDataQueryInputFormat, createDuckDbConnection } from "./formats";

export { listDataQuerySources } from "./source-resolution";

export { prepareDataQuerySource } from "./prepare-source";

export { prepareDataQueryWorkspace } from "./prepare-workspace";

export { executeDataQueryForTable, executeDataQueryForAllRows } from "./execute";

export {
  collectDataQuerySourceIntrospection,
  collectDataQueryWorkspaceIntrospection,
  inspectDataQueryExtensions,
} from "./introspection";
