export type RendererCapability =
  | "blank-pages"
  | "body-origin"
  | "document-visibility"
  | "increment"
  | "landscape"
  | "narrow-margins"
  | "positions"
  | "repagination"
  | "reset"
  | "separator"
  | "typography";

export type PageOrientation = "landscape" | "portrait";
export type PageNumberRegion = "bottom-center" | "bottom-right" | "top-right";

export type VisualReviewAssertion =
  | "color"
  | "cover-transition"
  | "font-family"
  | "separator"
  | "stylesheet-cascade"
  | "typography";

export interface WeasyPrintCandidate {
  id: string;
  weasyPrintVersion: string;
  dependencies: {
    pydyf: string;
    fontTools: string;
  };
}

export interface ExpectedPhysicalPage {
  marker: string;
  pageNumberLabels: readonly string[];
  pageNumberRegion?: PageNumberRegion;
  forbiddenText?: readonly string[];
}

export interface ExpectedPdfDocument {
  pageCount: number;
  sizeMillimeters: readonly [width: number, height: number];
  orientation: PageOrientation;
  pages: readonly ExpectedPhysicalPage[];
  pngPages: readonly number[];
}

export interface RendererContractScenario {
  id: string;
  purpose: string;
  required: boolean;
  capabilities: readonly RendererCapability[];
  html: string;
  css: string;
  expected: ExpectedPdfDocument;
}

export interface ProductRendererScenario {
  id: string;
  purpose: string;
  required: true;
  markdown: string;
  profile: string;
  template?: string;
  css?: string;
  expected: ExpectedPdfDocument;
  visualReviewRequired: readonly VisualReviewAssertion[];
}

export type ProjectRendererLaunchMode = "bundle" | "explicit-roles";

export interface ProjectRendererScenario {
  id: string;
  purpose: string;
  required: true;
  candidateIds: readonly WeasyPrintCandidate["id"][];
  authoring:
    | {
        mode: "cover-image-only";
        coverImage: { fileName: string; base64: string };
        expectedProjectSignalMode: "deterministic";
        liveCodexAllowed: false;
      }
    | {
        mode: "base-profile-only";
        baseProfile: string;
        expectedProjectSignalMode: "deterministic";
        liveCodexAllowed: false;
      };
  markdown: string;
  launchModes: readonly ProjectRendererLaunchMode[];
  expected: ExpectedPdfDocument;
  visualReviewRequired: readonly VisualReviewAssertion[];
  equivalenceBoundary?: {
    compare: readonly ["bundle", "explicit-roles"];
    automated: readonly string[];
    excluded: readonly string[];
  };
}

export interface MaterializedRendererContract {
  catalogDigest: string;
  fixtureRoot: string;
  bodyHookPaths: Readonly<Record<string, string>>;
  scenarioDirectories: Readonly<Record<string, string>>;
  launch: {
    markdownPath: string;
    profilePath: string;
  };
  productLaunches: Readonly<
    Record<
      string,
      {
        markdownPath: string;
        profilePath: string;
        templatePath?: string;
        cssPath?: string;
      }
    >
  >;
  projectLaunches: Readonly<
    Record<
      string,
      {
        authoringDirectory: string;
        baseProfilePath?: string;
        coverImagePath?: string;
        markdownPath: string;
        projectDirectory: string;
        bundlePath: string;
        profilePath: string;
        templatePath: string;
        cssPath: string;
      }
    >
  >;
}
