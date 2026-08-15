import { MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKENS } from "../markdown-pdf/profile/page-number-format";

export type TemplateCompletionKind =
  | "rename-template"
  | "markdown-pdf-page-label"
  | "markdown-pdf-repeating-content";

type RenameTemplateCandidateScope = "root" | "timestamp" | "date";

export type TemplateCandidateScope =
  | RenameTemplateCandidateScope
  | "page-label"
  | "repeating-content";

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

const DATE_TEMPLATE_CANDIDATES = ["{date}", "{date_local}", "{date_utc}"] as const;

const MARKDOWN_PDF_PAGE_LABEL_CANDIDATES = MARKDOWN_PDF_PAGE_NUMBER_FORMAT_TOKENS.map(
  (token) => `{${token}}`,
);

const MARKDOWN_PDF_REPEATING_CONTENT_CANDIDATES = [
  "{title}",
  "{company}",
  "{author}",
  "{date}",
] as const;

function resolveRenameTemplateCandidateScope(fragment: string): RenameTemplateCandidateScope {
  if (fragment.startsWith("{timestamp")) {
    return "timestamp";
  }
  if (fragment.startsWith("{date")) {
    return "date";
  }
  return "root";
}

function getRenameTemplateCandidates(scope: RenameTemplateCandidateScope): readonly string[] {
  if (scope === "timestamp") {
    return TIMESTAMP_TEMPLATE_CANDIDATES;
  }
  if (scope === "date") {
    return DATE_TEMPLATE_CANDIDATES;
  }
  return ROOT_TEMPLATE_CANDIDATES;
}

function getTemplateCandidates(
  kind: TemplateCompletionKind,
  fragment: string,
): {
  candidates: readonly string[];
  scope: TemplateCandidateScope;
} {
  if (kind === "markdown-pdf-page-label") {
    return {
      candidates: MARKDOWN_PDF_PAGE_LABEL_CANDIDATES,
      scope: "page-label",
    };
  }

  if (kind === "markdown-pdf-repeating-content") {
    return {
      candidates: MARKDOWN_PDF_REPEATING_CONTENT_CANDIDATES,
      scope: "repeating-content",
    };
  }

  const scope = resolveRenameTemplateCandidateScope(fragment);
  return {
    candidates: getRenameTemplateCandidates(scope),
    scope,
  };
}

export function resolveTemplateCompletionMatch(
  value: string,
  kind: TemplateCompletionKind = "rename-template",
): TemplateCompletionMatch | undefined {
  const fragmentStart = value.lastIndexOf("{");
  const lastClose = value.lastIndexOf("}");
  if (fragmentStart < 0 || fragmentStart < lastClose) {
    return undefined;
  }

  const fragment = value.slice(fragmentStart);
  if (fragment.length === 0) {
    return undefined;
  }

  const registry = getTemplateCandidates(kind, fragment);
  const candidates = registry.candidates.filter((candidate) => candidate.startsWith(fragment));
  if (candidates.length === 0) {
    return undefined;
  }

  return {
    candidates,
    fragment,
    fragmentStart,
    scope: registry.scope,
    scopeKey: `${registry.scope}:${fragment}`,
  };
}

export function deriveTemplateGhostSuffix(fragment: string, candidate: string): string {
  if (!candidate.startsWith(fragment)) {
    return "";
  }
  return candidate.slice(fragment.length);
}
