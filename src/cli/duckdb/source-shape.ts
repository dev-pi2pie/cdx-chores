export {
  DATA_SOURCE_SHAPE_ARTIFACT_TYPE,
  DATA_SOURCE_SHAPE_VERSION,
  type DataSourceShapeArtifact,
  type DataSourceShapeInputReference,
  type DataSourceShapeSelection,
  type DataSourceShapeSuggestionContext,
  type DataSourceShapeSuggestionResult,
  type DataSourceShapeSuggestionRunner,
} from "./source-shape/types";

export {
  createSourceShapeInputReference,
  ensureKnownSourceShapeInputFormat,
  generateDataSourceShapeFileName,
  isRecord,
  normalizeArtifactPath,
  normalizeOptionalPositiveInteger,
  throwUnsupportedSourceShapeVersion,
} from "./source-shape/normalize";

export {
  createDataSourceShapeArtifact,
  readDataSourceShapeArtifact,
  resolveReusableSourceShape,
  writeDataSourceShapeArtifact,
} from "./source-shape/artifact";

export { suggestDataSourceShapeWithCodex } from "./source-shape/suggestions";
