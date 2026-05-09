import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
} from "../src/cli/markdown-pdf";

describe("markdown PDF recipe generation", () => {
  test("generates report ToC page break CSS by default", () => {
    const recipe = createMarkdownPdfRecipe(
      normalizeMarkdownPdfOptions({ preset: "report", toc: true }),
    );

    expect(recipe.templateHtml).toContain("$body$");
    expect(recipe.templateHtml).toContain("$toc$");
    expect(recipe.styleCss).toContain("size: A4 portrait");
    expect(recipe.styleCss).toContain("break-after: page");
  });

  test("honors explicit no ToC page break", () => {
    const recipe = createMarkdownPdfRecipe(
      normalizeMarkdownPdfOptions({ preset: "report", toc: true, tocPageBreak: "none" }),
    );

    expect(recipe.styleCss).not.toContain("break-after: page");
  });

  test("generates profile page chrome and page numbers", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        metadata: {
          company: "Example Co.",
          title: "Quarterly Report",
        },
        header: {
          left: "{company}",
          right: "{title}",
        },
        footer: {
          left: "{author}",
        },
        pageNumbers: {
          enabled: true,
          format: "Page {page}",
        },
      },
      frontmatter: {
        author: "Noname",
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions({ toc: true }), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).toContain('@top-left {\n    content: "Example Co.";');
    expect(recipe.styleCss).toContain('@top-right {\n    content: "Quarterly Report";');
    expect(recipe.styleCss).toContain('@bottom-left {\n    content: "Noname";');
    expect(recipe.styleCss).toContain('@bottom-center {\n    content: "Page " counter(page);');
    expect(recipe.styleCss).toContain("@page toc");
    expect(recipe.styleCss).not.toContain("counter(pages)");
  });

  test("keeps page numbers disabled by default", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {},
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).not.toContain("counter(page)");
    expect(recipe.styleCss).not.toContain("@bottom-center");
  });

  test("honors explicit page-number positions", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        pageNumbers: {
          enabled: true,
          position: "top-right",
          format: "{page}",
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).toContain("@top-right {\n    content: counter(page);");
    expect(recipe.styleCss).not.toContain("@bottom-center {\n    content: counter(page);");
  });

  test("generates plain cover HTML and cover page CSS", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        cover: {
          enabled: true,
          style: "plain",
        },
      },
      frontmatter: {
        title: "Quarterly Report",
        subtitle: "Runtime Notes",
        author: "Noname",
        company: "Example Co.",
        date: "2026-05-07",
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.templateHtml).toContain('class="pdf-cover pdf-cover--plain"');
    expect(recipe.templateHtml).toContain("Quarterly Report");
    expect(recipe.templateHtml).toContain("Runtime Notes");
    expect(recipe.templateHtml).toContain("Noname | Example Co. | 2026-05-07");
    expect(recipe.styleCss).toContain("@page cover");
    expect(recipe.styleCss).toContain("@top-left {\n    content: none;");
    expect(recipe.styleCss).toContain("@bottom-center {\n    content: none;");
    expect(recipe.styleCss).toContain(".pdf-cover");
  });

  test("generates report cover CSS with landscape page options", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        cover: {
          enabled: true,
          style: "report",
          fields: {
            title: "{company} Engineering Report",
          },
        },
      },
      frontmatter: {
        company: "Example Co.",
      },
    });
    const recipe = createMarkdownPdfRecipe(
      normalizeMarkdownPdfOptions({ orientation: "landscape" }),
      {
        profile: normalizedProfile.profile,
      },
    );

    expect(recipe.templateHtml).toContain("Example Co. Engineering Report");
    expect(recipe.templateHtml).toContain("pdf-cover--report");
    expect(recipe.styleCss).toContain("size: A4 landscape");
    expect(recipe.styleCss).toContain(".pdf-cover--report .pdf-cover__content");
  });
});
