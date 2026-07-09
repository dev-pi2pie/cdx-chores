export type MarkdownPdfRenderBundleRole = "profile" | "template" | "css";

export type MarkdownPdfRenderBundleResolutionSource = "bundle" | "explicit";

export interface MarkdownPdfRenderBundleCandidate {
  basename: string;
  path: string;
  role: MarkdownPdfRenderBundleRole;
}

export interface MarkdownPdfRenderBundleResolvedInput {
  path: string;
  source: MarkdownPdfRenderBundleResolutionSource;
}

export interface MarkdownPdfRenderBundleResolvedInputs {
  profile?: MarkdownPdfRenderBundleResolvedInput;
  template?: MarkdownPdfRenderBundleResolvedInput;
  css?: MarkdownPdfRenderBundleResolvedInput;
}
