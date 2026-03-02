import {
  parsePathSuggestionInput,
  resolvePathSuggestions,
  type PathSuggestionTargetKind,
} from "./path-suggestions";

export interface SiblingPreviewCandidateSet {
  scopeKey: string;
  replacements: string[];
}

export interface ResolveSiblingPreviewCandidatesOptions {
  cwd: string;
  input: string;
  includeHidden?: boolean;
  maxSuggestions?: number;
  targetKind?: PathSuggestionTargetKind;
  fileExtensions?: string[];
}

function normalizeScopeExtensions(extensions: string[] | undefined): string {
  if (!extensions || extensions.length === 0) {
    return "";
  }

  return extensions
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .sort()
    .join(",");
}

export function deriveSiblingPreviewScopeKey(
  options: ResolveSiblingPreviewCandidatesOptions,
): string {
  const parsed = parsePathSuggestionInput(options.cwd, options.input);
  const hiddenMode =
    (options.includeHidden ?? false) || parsed.fragment.startsWith(".") ? "include" : "exclude";

  return [
    parsed.baseDirectoryPath,
    parsed.directoryInput,
    parsed.fragment,
    hiddenMode,
    options.targetKind ?? "any",
    normalizeScopeExtensions(options.fileExtensions),
  ].join("\u0000");
}

export async function resolveSiblingPreviewCandidates(
  options: ResolveSiblingPreviewCandidatesOptions,
): Promise<SiblingPreviewCandidateSet> {
  const suggestions = await resolvePathSuggestions({
    cwd: options.cwd,
    input: options.input,
    includeHidden: options.includeHidden,
    maxSuggestions: options.maxSuggestions,
    targetKind: options.targetKind,
    fileExtensions: options.fileExtensions,
    minChars: 0,
    enforceTrigger: false,
  });

  const replacements = Array.from(new Set(suggestions.map((item) => item.replacement)));

  return {
    scopeKey: deriveSiblingPreviewScopeKey(options),
    replacements,
  };
}
