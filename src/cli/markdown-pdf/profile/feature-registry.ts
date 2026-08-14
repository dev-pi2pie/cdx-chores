export const MARKDOWN_PDF_PROFILE_BASELINE_REVISION = 2;
export const MARKDOWN_PDF_PROFILE_CURRENT_REVISION = 3;

export const MARKDOWN_PDF_CODE_THEMES = [
  "github-light",
  "light-plus",
  "min-light",
  "vitesse-light",
  "catppuccin-latte",
] as const;

export const MARKDOWN_PDF_PAGE_CHROME_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export const MARKDOWN_PDF_PAGE_NUMBER_SCOPES = ["document", "body"] as const;
export const MARKDOWN_PDF_PAGE_NUMBER_COUNT_ORIGINS = ["document", "body"] as const;
export const MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS = [400, 500, 600, 700] as const;
export const MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES = ["solid"] as const;
export const MARKDOWN_PDF_COVER_STYLES = ["plain", "report"] as const;
export const MARKDOWN_PDF_METADATA_TITLE_BLOCK_MODES = ["auto", "show", "hide"] as const;

export type MarkdownPdfProfileFeatureKind = "declaration" | "dynamic-object" | "field" | "object";

export type MarkdownPdfProfileNormalizationRoute =
  | "code"
  | "cover"
  | "declaration"
  | "fonts"
  | "identity"
  | "metadata"
  | "page-chrome"
  | "page-numbers"
  | "pdf"
  | "recipe"
  | "title-block";

export interface MarkdownPdfProfileFeatureValue {
  introducedIn: number;
  value: string | number | boolean;
  rendererCapability?: string;
}

export interface MarkdownPdfProfileFeatureDefinition {
  introducedIn: number;
  kind: MarkdownPdfProfileFeatureKind;
  normalizationRoute: MarkdownPdfProfileNormalizationRoute;
  path: string;
  rendererCapability?: string;
  revisionContribution?: boolean;
  values?: readonly MarkdownPdfProfileFeatureValue[];
}

function feature(
  path: string,
  normalizationRoute: MarkdownPdfProfileNormalizationRoute,
  input: Partial<Omit<MarkdownPdfProfileFeatureDefinition, "normalizationRoute" | "path">> = {},
): MarkdownPdfProfileFeatureDefinition {
  return {
    introducedIn: MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
    kind: "field",
    ...input,
    normalizationRoute,
    path,
  };
}

/**
 * Authoritative inventory of accepted serialized Profile keys and revision metadata.
 * Dynamic member names are bounded by their owning object validator rather than
 * represented as independent schema features.
 */
export const MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY = [
  feature("schemaVersion", "declaration", {
    introducedIn: MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
    kind: "declaration",
    revisionContribution: false,
  }),
  feature("profile", "identity", { kind: "object" }),
  feature("profile.id", "identity"),
  feature("profile.source", "identity"),
  feature("profile.basedOn", "identity"),
  feature("profile.preset", "identity"),
  feature("profile.createdAt", "identity"),
  feature("page", "recipe", { kind: "object" }),
  feature("page.size", "recipe"),
  feature("page.orientation", "recipe"),
  feature("page.margin", "recipe"),
  feature("page.marginX", "recipe"),
  feature("page.marginY", "recipe"),
  feature("page.marginTop", "recipe"),
  feature("page.marginRight", "recipe"),
  feature("page.marginBottom", "recipe"),
  feature("page.marginLeft", "recipe"),
  feature("toc", "recipe", { kind: "object" }),
  feature("toc.enabled", "recipe"),
  feature("toc.depth", "recipe"),
  feature("toc.pageBreak", "recipe"),
  feature("metadata", "metadata", { kind: "dynamic-object" }),
  feature("pdf", "pdf", { kind: "object" }),
  feature("pdf.content-langs", "pdf"),
  feature("fonts", "fonts", { kind: "object" }),
  feature("fonts.body", "fonts", { kind: "dynamic-object" }),
  feature("fonts.heading", "fonts", { kind: "dynamic-object" }),
  feature("fonts.code", "fonts", { kind: "dynamic-object" }),
  feature("fonts.pageChrome", "fonts", { kind: "dynamic-object" }),
  feature("cover", "cover", { kind: "object" }),
  feature("cover.enabled", "cover"),
  feature("cover.style", "cover", {
    values: MARKDOWN_PDF_COVER_STYLES.map((value) => ({
      introducedIn: MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
      value,
    })),
  }),
  feature("cover.fields", "cover", { kind: "object" }),
  feature("cover.fields.title", "cover"),
  feature("cover.fields.subtitle", "cover"),
  feature("cover.fields.author", "cover"),
  feature("cover.fields.company", "cover"),
  feature("cover.fields.date", "cover"),
  feature("header", "page-chrome", { kind: "object" }),
  feature("header.left", "page-chrome"),
  feature("header.center", "page-chrome"),
  feature("header.right", "page-chrome"),
  feature("header.style", "page-chrome", {
    introducedIn: 3,
    kind: "object",
  }),
  feature("footer", "page-chrome", { kind: "object" }),
  feature("footer.left", "page-chrome"),
  feature("footer.center", "page-chrome"),
  feature("footer.right", "page-chrome"),
  feature("footer.style", "page-chrome", {
    introducedIn: 3,
    kind: "object",
  }),
  ...(["header", "footer"] as const).flatMap((area) => [
    feature(`${area}.style.fontSize`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.fontSize",
    }),
    feature(`${area}.style.fontWeight`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.fontWeight",
      values: MARKDOWN_PDF_PAGE_CHROME_FONT_WEIGHTS.map((value) => ({
        introducedIn: 3,
        value,
      })),
    }),
    feature(`${area}.style.lineHeight`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.lineHeight",
    }),
    feature(`${area}.style.color`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.color",
    }),
    feature(`${area}.style.separator`, "page-chrome", {
      introducedIn: 3,
      kind: "object",
    }),
    feature(`${area}.style.separator.width`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.separator.width",
    }),
    feature(`${area}.style.separator.style`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.separator.style",
      values: MARKDOWN_PDF_PAGE_CHROME_SEPARATOR_STYLES.map((value) => ({
        introducedIn: 3,
        value,
      })),
    }),
    feature(`${area}.style.separator.color`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.separator.color",
    }),
    feature(`${area}.style.separator.gap`, "page-chrome", {
      introducedIn: 3,
      rendererCapability: "pageChrome.separator.gap",
    }),
  ]),
  feature("pageNumbers", "page-numbers", { kind: "object" }),
  feature("pageNumbers.enabled", "page-numbers"),
  feature("pageNumbers.position", "page-numbers", {
    values: MARKDOWN_PDF_PAGE_CHROME_POSITIONS.map((value) => ({
      introducedIn: MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
      value,
    })),
  }),
  feature("pageNumbers.format", "page-numbers"),
  feature("pageNumbers.scope", "page-numbers", {
    values: [
      { introducedIn: 2, value: "body" },
      {
        introducedIn: 3,
        rendererCapability: "pageNumbers.scope.document",
        value: "document",
      },
    ],
  }),
  feature("pageNumbers.countFrom", "page-numbers", {
    introducedIn: 3,
    values: [
      { introducedIn: 3, value: "document" },
      {
        introducedIn: 3,
        rendererCapability: "pageNumbers.countFrom.body",
        value: "body",
      },
    ],
  }),
  feature("pageNumbers.start", "page-numbers", {
    introducedIn: 3,
    rendererCapability: "pageNumbers.start",
  }),
  feature("pageNumbers.increment", "page-numbers", {
    introducedIn: 3,
    rendererCapability: "pageNumbers.increment",
  }),
  feature("titleBlock", "title-block", { kind: "object" }),
  feature("titleBlock.metadataTitle", "title-block", {
    values: MARKDOWN_PDF_METADATA_TITLE_BLOCK_MODES.map((value) => ({
      introducedIn: MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
      value,
    })),
  }),
  feature("code", "code", { kind: "object" }),
  feature("code.highlight", "code"),
  feature("code.theme", "code", {
    values: MARKDOWN_PDF_CODE_THEMES.map((value) => ({
      introducedIn: MARKDOWN_PDF_PROFILE_BASELINE_REVISION,
      value,
    })),
  }),
  feature("code.lineNumbers", "code"),
  feature("code.transformerNotation", "code"),
] as const satisfies readonly MarkdownPdfProfileFeatureDefinition[];

const FEATURE_BY_PATH = new Map(
  MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.map((definition) => [definition.path, definition]),
);

export function markdownPdfProfileFeatureAtPath(
  path: string,
): MarkdownPdfProfileFeatureDefinition | undefined {
  return FEATURE_BY_PATH.get(path);
}

export function markdownPdfProfileFeatureKeys(parentPath = ""): ReadonlySet<string> {
  const prefix = parentPath.length > 0 ? `${parentPath}.` : "";
  return new Set(
    MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.flatMap((definition) => {
      if (!definition.path.startsWith(prefix)) {
        return [];
      }
      const relativePath = definition.path.slice(prefix.length);
      return relativePath.includes(".") ? [] : [relativePath];
    }),
  );
}

export function markdownPdfProfileFeatureValues(
  path: string,
): readonly MarkdownPdfProfileFeatureValue[] {
  return markdownPdfProfileFeatureAtPath(path)?.values ?? [];
}

export function isMarkdownPdfProfileFeatureValue(path: string, value: unknown): boolean {
  return markdownPdfProfileFeatureValues(path).some((candidate) => candidate.value === value);
}

export function markdownPdfProfileRendererCapability(
  path: string,
  value?: unknown,
): string | undefined {
  const definition = markdownPdfProfileFeatureAtPath(path);
  return (
    definition?.values?.find((candidate) => candidate.value === value)?.rendererCapability ??
    definition?.rendererCapability
  );
}

export function markdownPdfProfileRendererCapabilityFields(
  capabilityId: string,
): readonly string[] {
  return MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.flatMap((definition) => {
    const ownsCapability =
      definition.rendererCapability === capabilityId ||
      definition.values?.some((value) => value.rendererCapability === capabilityId);
    return ownsCapability ? [definition.path] : [];
  });
}

export interface MarkdownPdfProfileFeatureCombinationRule {
  introducedIn: number;
  message: string;
  paths: readonly string[];
  supported(values: Readonly<Record<string, unknown>>): boolean;
}

export const MARKDOWN_PDF_PROFILE_FEATURE_COMBINATION_RULES: readonly MarkdownPdfProfileFeatureCombinationRule[] =
  [
    {
      introducedIn: 3,
      message: "profile.pageNumbers.scope document cannot be used with countFrom body.",
      paths: ["pageNumbers.scope", "pageNumbers.countFrom"],
      supported: (values) =>
        values["pageNumbers.scope"] !== "document" || values["pageNumbers.countFrom"] !== "body",
    },
  ];

export function findUnsupportedMarkdownPdfProfileFeatureCombination(
  values: Readonly<Record<string, unknown>>,
): MarkdownPdfProfileFeatureCombinationRule | undefined {
  return MARKDOWN_PDF_PROFILE_FEATURE_COMBINATION_RULES.find((rule) => !rule.supported(values));
}
