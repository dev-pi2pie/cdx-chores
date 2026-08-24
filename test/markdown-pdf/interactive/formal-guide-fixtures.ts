import type {
  MarkdownPdfFormalGuideAnswers,
  MarkdownPdfProfileFormalGuideAnswers,
} from "../../../src/cli/interactive/markdown/formal-guide";

export const BASE_ANSWERS: MarkdownPdfFormalGuideAnswers = {
  layout: {
    preset: "article",
    pageSize: "A4",
    orientation: { mode: "preset-default" },
  },
  margins: { mode: "preset-default" },
  toc: { enabled: false },
};

export const BASE_PROFILE_ANSWERS: MarkdownPdfProfileFormalGuideAnswers = {
  ...BASE_ANSWERS,
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
  code: {
    highlight: false,
    theme: "github-light",
    lineNumbers: false,
    transformerNotation: false,
  },
  pageNumbers: {
    enabled: false,
    position: "bottom-center",
    format: "{page}",
    scope: "body",
    countFrom: "document",
    start: 1,
    increment: 1,
  },
  pageChrome: {
    header: { left: "", center: "", right: "" },
    footer: { left: "", center: "", right: "" },
  },
};
