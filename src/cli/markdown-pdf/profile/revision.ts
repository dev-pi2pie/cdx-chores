import {
  MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
  MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
  MARKDOWN_PDF_PROFILE_FEATURE_COMBINATION_RULES,
  markdownPdfProfileFeatureAtPath,
} from "./feature-registry";

export type MarkdownPdfProfileRevisionState =
  | "forward"
  | "invalid"
  | "missing"
  | "stale"
  | "supported";

export interface MarkdownPdfProfileRevisionAssessment {
  currentRevision: number;
  declaredRevision?: number;
  inferredRevision: number;
  state: MarkdownPdfProfileRevisionState;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function valueAtPath(profile: Record<string, unknown>, path: string): unknown {
  let current: unknown = profile;
  for (const part of path.split(".")) {
    if (!isPlainObject(current) || !Object.hasOwn(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function hasPath(profile: Record<string, unknown>, path: string): boolean {
  let current: unknown = profile;
  for (const part of path.split(".")) {
    if (!isPlainObject(current) || !Object.hasOwn(current, part)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

function inferObjectRevision(
  object: Record<string, unknown>,
  parentPath: string,
  initialRevision: number,
): number {
  let revision = initialRevision;
  for (const [key, value] of Object.entries(object)) {
    const path = parentPath.length > 0 ? `${parentPath}.${key}` : key;
    const definition = markdownPdfProfileFeatureAtPath(path);
    if (!definition) {
      continue;
    }
    if (definition.revisionContribution !== false) {
      revision = Math.max(revision, definition.introducedIn);
      const matchingValue = definition.values?.find((candidate) => candidate.value === value);
      if (matchingValue) {
        revision = Math.max(revision, matchingValue.introducedIn);
      }
    }
    if (definition.kind === "object" && isPlainObject(value)) {
      revision = inferObjectRevision(value, path, revision);
    }
  }
  return revision;
}

export function inferMarkdownPdfProfileRevision(profile: Record<string, unknown>): number {
  let revision = inferObjectRevision(profile, "", MARKDOWN_PDF_PROFILE_BASELINE_REVISION);

  for (const rule of MARKDOWN_PDF_PROFILE_FEATURE_COMBINATION_RULES) {
    if (!rule.paths.every((path) => hasPath(profile, path))) {
      continue;
    }
    const values = Object.fromEntries(rule.paths.map((path) => [path, valueAtPath(profile, path)]));
    if (rule.supported(values)) {
      revision = Math.max(revision, rule.introducedIn);
    }
  }

  return revision;
}

export function assessMarkdownPdfProfileRevision(
  profile: Record<string, unknown>,
): MarkdownPdfProfileRevisionAssessment {
  const inferredRevision = inferMarkdownPdfProfileRevision(profile);
  const common = {
    currentRevision: MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
    inferredRevision,
  };

  if (!Object.hasOwn(profile, "schemaVersion")) {
    return { ...common, state: "missing" };
  }

  const declaredRevision = profile.schemaVersion;
  if (
    typeof declaredRevision !== "number" ||
    !Number.isSafeInteger(declaredRevision) ||
    declaredRevision <= 0
  ) {
    return { ...common, state: "invalid" };
  }
  if (declaredRevision > MARKDOWN_PDF_PROFILE_CURRENT_REVISION) {
    return { ...common, declaredRevision, state: "forward" };
  }
  if (declaredRevision < inferredRevision) {
    return { ...common, declaredRevision, state: "stale" };
  }
  return { ...common, declaredRevision, state: "supported" };
}
