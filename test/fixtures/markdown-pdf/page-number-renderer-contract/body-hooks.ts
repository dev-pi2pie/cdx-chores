export const PAGE_NUMBER_BODY_HOOK_CASES = [
  {
    id: "generated-hook-document-origin",
    countFrom: "document",
    expected: "supported",
    html: '<main class="document-body"><p>$body$</p></main>\n',
  },
  {
    id: "generated-hook-body-origin",
    countFrom: "body",
    expected: "supported",
    html: '<main class="document-body"><p>$body$</p></main>\n',
  },
  {
    id: "legacy-hook-document-origin",
    countFrom: "document",
    expected: "warning-fallback",
    html: "<main><p>$body$</p></main>\n",
  },
  {
    id: "legacy-hook-body-origin",
    countFrom: "body",
    expected: "hard-error",
    html: "<main><p>$body$</p></main>\n",
  },
] as const;
