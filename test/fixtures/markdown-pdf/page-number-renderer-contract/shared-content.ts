export const PORTRAIT_SIZE = [148, 210] as const;
export const LANDSCAPE_SIZE = [210, 148] as const;

export const baseCss = String.raw`
html {
  font-family: sans-serif;
  font-size: 10pt;
}

body {
  margin: 0;
}

.fixture-page {
  break-after: page;
}

.fixture-page:last-child {
  break-after: auto;
}

.page-marker {
  font: 700 12pt monospace;
}
`;

export function withBaseCss(css: string): string {
  return `${baseCss}${css}`;
}

export function fixtureHtml(
  pages: readonly { marker: string; pageName: string; content?: string }[],
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
${pages
  .map(
    (page) => `    <section class="fixture-page ${page.pageName}">
      <p class="page-marker">${page.marker}</p>
      ${page.content ?? "<p>Deterministic renderer-contract content.</p>"}
    </section>`,
  )
  .join("\n")}
  </body>
</html>
`;
}
