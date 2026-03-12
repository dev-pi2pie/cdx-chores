export type TemplateCandidateScope = "root" | "timestamp" | "date";

export interface TemplateCompletionMatch {
  candidates: string[];
  fragment: string;
  fragmentStart: number;
  scope: TemplateCandidateScope;
  scopeKey: string;
}

const ROOT_TEMPLATE_CANDIDATES = [
  "{prefix}",
  "{timestamp}",
  "{date}",
  "{stem}",
  "{uid}",
  "{serial}",
] as const;

const TIMESTAMP_TEMPLATE_CANDIDATES = [
  "{timestamp}",
  "{timestamp_local}",
  "{timestamp_utc}",
  "{timestamp_local_iso}",
  "{timestamp_utc_iso}",
  "{timestamp_local_12h}",
  "{timestamp_utc_12h}",
] as const;

const DATE_TEMPLATE_CANDIDATES = [
  "{date}",
  "{date_local}",
  "{date_utc}",
] as const;

function resolveTemplateCandidateScope(fragment: string): TemplateCandidateScope {
  if (fragment.startsWith("{timestamp")) {
    return "timestamp";
  }
  if (fragment.startsWith("{date")) {
    return "date";
  }
  return "root";
}

function getCandidatesForScope(scope: TemplateCandidateScope): readonly string[] {
  if (scope === "timestamp") {
    return TIMESTAMP_TEMPLATE_CANDIDATES;
  }
  if (scope === "date") {
    return DATE_TEMPLATE_CANDIDATES;
  }
  return ROOT_TEMPLATE_CANDIDATES;
}

export function resolveTemplateCompletionMatch(value: string): TemplateCompletionMatch | undefined {
  const fragmentStart = value.lastIndexOf("{");
  const lastClose = value.lastIndexOf("}");
  if (fragmentStart < 0 || fragmentStart < lastClose) {
    return undefined;
  }

  const fragment = value.slice(fragmentStart);
  if (fragment.length === 0) {
    return undefined;
  }

  const scope = resolveTemplateCandidateScope(fragment);
  const candidates = getCandidatesForScope(scope).filter((candidate) => candidate.startsWith(fragment));
  if (candidates.length === 0) {
    return undefined;
  }

  return {
    candidates,
    fragment,
    fragmentStart,
    scope,
    scopeKey: `${scope}:${fragment}`,
  };
}

export function deriveTemplateGhostSuffix(fragment: string, candidate: string): string {
  if (!candidate.startsWith(fragment)) {
    return "";
  }
  return candidate.slice(fragment.length);
}
