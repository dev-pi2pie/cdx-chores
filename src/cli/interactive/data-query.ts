// Compatibility facade for the legacy flat module path. Keep the owned exports
// sourced from the folder facade so callers do not depend on extracted modules.
export {
  collectInteractiveIntrospection,
  promptDelimitedHeaderMode,
  promptInteractiveInputFormat,
  promptOptionalSourceSelection,
  reviewInteractiveHeaderMappings,
  runInteractiveDataQuery,
} from "./data-query/index";
