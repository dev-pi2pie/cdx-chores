export const MARKDOWN_PDF_CODE_CLASSES = {
  block: "cdx-code",
  plainBlock: "cdx-code--plain",
  highlightedBlock: "cdx-code--highlighted",
  numberedBlock: "cdx-code--numbered",
  content: "cdx-code__content",
  shikiLine: "line",
  line: "cdx-code-line",
  lineNumber: "cdx-code-line-number",
  lineContent: "cdx-code-line-content",
  lineHighlighted: "cdx-code-line--highlighted",
  lineInserted: "cdx-code-line--inserted",
  lineDeleted: "cdx-code-line--deleted",
} as const;

export const MARKDOWN_PDF_CODE_FONT_SELECTORS = [
  "pre",
  "code",
  `.${MARKDOWN_PDF_CODE_CLASSES.line}`,
  `.${MARKDOWN_PDF_CODE_CLASSES.lineContent}`,
].join(", ");

export function createMarkdownPdfCodeCss(): string {
  const classes = MARKDOWN_PDF_CODE_CLASSES;

  return `pre.${classes.block} {
  overflow-wrap: anywhere;
}

pre.${classes.highlightedBlock} {
  border-color: #d8dee4;
}

pre.${classes.plainBlock} code,
pre.${classes.highlightedBlock} code {
  font-family: inherit;
}

pre.${classes.numberedBlock} {
  padding: 0.55rem 0;
}

pre.${classes.numberedBlock} code.${classes.content} {
  display: block;
}

.${classes.line} {
  display: flex;
  line-height: 1.45;
  break-inside: avoid;
}

.${classes.lineNumber} {
  box-sizing: border-box;
  color: #6e7781;
  flex: 0 0 2.75rem;
  padding: 0 0.65rem 0 0.55rem;
  text-align: right;
  border-right: 0.6pt solid #d8dee4;
}

.${classes.lineContent} {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 0.7rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.${classes.lineHighlighted} {
  background: #fff8c5;
}

.${classes.lineInserted} {
  background: #dafbe1;
}

.${classes.lineDeleted} {
  background: #ffebe9;
}
`;
}
