export {
  DATA_HEADER_MAPPING_ARTIFACT_TYPE,
  DATA_HEADER_MAPPING_VERSION,
  type DataHeaderMappingArtifact,
  type DataHeaderMappingEntry,
  type DataHeaderMappingFormat,
  type DataHeaderMappingInputReference,
  type DataHeaderMappingShape,
  type DataHeaderSuggestionEvidence,
  type DataHeaderSuggestionIntrospection,
  type DataHeaderSuggestionResult,
  type DataHeaderSuggestionRunner,
} from "./header-mapping/types";

export {
  createHeaderMappingInputReference,
  ensureKnownQueryInputFormat,
  ensureNonEmptyString,
  generateDataHeaderMappingFileName,
  isRecord,
  normalizeArtifactPath,
  normalizeHeaderMappingTargetName,
  normalizeOptionalString,
  throwUnsupportedHeaderMappingVersion,
} from "./header-mapping/normalize";

export {
  collectHeaderSuggestionEvidence,
  suggestDataHeaderMappingsWithCodex,
} from "./header-mapping/suggestions";

export {
  createDataHeaderMappingArtifact,
  normalizeAndValidateAcceptedHeaderMappings,
  readDataHeaderMappingArtifact,
  resolveReusableHeaderMappings,
  writeDataHeaderMappingArtifact,
} from "./header-mapping/artifact";
