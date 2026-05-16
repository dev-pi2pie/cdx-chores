import type { NormalizedMarkdownPdfProfile } from "./types";

export const DEFAULT_MARKDOWN_PDF_PROFILE: Record<string, unknown> = {
  page: {
    size: "A4",
    orientation: "portrait",
    margin: "18mm",
  },
  fonts: {
    body: {
      default: "serif",
    },
    code: {
      default: "monospace",
    },
  },
  cover: {
    enabled: false,
  },
  header: {},
  footer: {},
  pageNumbers: {
    enabled: false,
  },
  code: {
    highlight: false,
    theme: "github-light",
    lineNumbers: false,
  },
};

export const DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE: NormalizedMarkdownPdfProfile = {
  metadata: {},
  code: {
    highlight: false,
    theme: "github-light",
    lineNumbers: false,
  },
  header: {
    left: "",
    center: "",
    right: "",
  },
  footer: {
    left: "",
    center: "",
    right: "",
  },
  pageNumbers: {
    enabled: false,
    position: "bottom-center",
    format: "{page}",
    scope: "body",
  },
  cover: {
    enabled: false,
    style: "plain",
    fields: {
      title: "{title}",
      subtitle: "{subtitle}",
      author: "{author}",
      company: "{company}",
      date: "{date}",
    },
  },
  fonts: {
    body: {},
    heading: {},
    code: {},
    pageChrome: {},
  },
  contentLangs: [],
};
