import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
} from "../src/cli/markdown-pdf";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../src/cli/markdown-pdf/profile/page-number-format";

const logicalCurrent = `counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`;

describe("markdown PDF recipe generation", () => {
  test("keeps the automatic metadata title inside the single body after the ToC", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        titleBlock: {
          metadataTitle: "auto",
        },
      },
      frontmatter: {
        title: "Current Role Order",
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions({ toc: true }), {
      profile: normalizedProfile.profile,
      titleSignals: {
        frontmatterTitle: { present: true, charCount: "Current Role Order".length },
        firstH1: { present: false, charCount: 0 },
        normalizedTitleMatch: false,
        duplicateVisibleTitleRisk: false,
      },
    });

    const roleMarkers = [
      '<nav id="TOC" role="doc-toc">',
      '<main class="document-body">',
      'class="document-title"',
      "$body$",
    ];
    const roleIndexes = roleMarkers.map((marker) => recipe.templateHtml.indexOf(marker));

    expect(roleIndexes.every((index) => index >= 0)).toBe(true);
    expect(roleIndexes).toEqual([...roleIndexes].sort((left, right) => left - right));
    expect(recipe.templateHtml.match(/<main class="document-body">/g)).toHaveLength(1);
  });

  test("suppresses an automatic metadata title when a dedicated cover exists", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        cover: { enabled: true, style: "plain" },
        titleBlock: { metadataTitle: "auto" },
      },
      frontmatter: { title: "Dedicated Cover" },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions({ toc: true }), {
      profile: normalizedProfile.profile,
      titleSignals: {
        frontmatterTitle: { present: true, charCount: "Dedicated Cover".length },
        firstH1: { present: false, charCount: 0 },
        normalizedTitleMatch: false,
        duplicateVisibleTitleRisk: false,
      },
    });

    const coverIndex = recipe.templateHtml.indexOf('class="pdf-cover pdf-cover--plain"');
    const tocIndex = recipe.templateHtml.indexOf('<nav id="TOC" role="doc-toc">');
    const bodyIndex = recipe.templateHtml.indexOf('<main class="document-body">');

    expect(coverIndex).toBeGreaterThanOrEqual(0);
    expect(coverIndex).toBeLessThan(tocIndex);
    expect(tocIndex).toBeLessThan(bodyIndex);
    expect(recipe.templateHtml).not.toContain('class="document-title"');
  });

  test("keeps an explicitly shown metadata title body-owned when a cover exists", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        cover: { enabled: true },
        titleBlock: { metadataTitle: "show" },
      },
      frontmatter: { title: "Repeated By Request" },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions({ toc: true }), {
      profile: normalizedProfile.profile,
    });

    const tocIndex = recipe.templateHtml.indexOf('<nav id="TOC" role="doc-toc">');
    const bodyIndex = recipe.templateHtml.indexOf('<main class="document-body">');
    const titleIndex = recipe.templateHtml.indexOf('class="document-title"');
    const bodyContentIndex = recipe.templateHtml.indexOf("$body$");

    expect(tocIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(titleIndex);
    expect(titleIndex).toBeLessThan(bodyContentIndex);
  });

  test("generates report ToC page break CSS by default", () => {
    const recipe = createMarkdownPdfRecipe(
      normalizeMarkdownPdfOptions({ preset: "report", toc: true }),
    );

    expect(recipe.templateHtml).toContain("$body$");
    expect(recipe.templateHtml).toContain('<main class="document-body">');
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

  test.each([
    {
      expected: [] as string[],
      label: "disabled ToC ignores an explicit both transition",
      options: { preset: "report" as const, toc: false, tocPageBreak: "both" as const },
    },
    {
      expected: [],
      label: "none",
      options: { preset: "report" as const, toc: true, tocPageBreak: "none" as const },
    },
    {
      expected: ["break-before: page;"],
      label: "before",
      options: { preset: "report" as const, toc: true, tocPageBreak: "before" as const },
    },
    {
      expected: ["break-after: page;"],
      label: "after",
      options: { preset: "article" as const, toc: true, tocPageBreak: "after" as const },
    },
    {
      expected: ["break-before: page;", "break-after: page;"],
      label: "both",
      options: { preset: "wide-table" as const, toc: true, tocPageBreak: "both" as const },
    },
    {
      expected: ["break-after: page;"],
      label: "report auto",
      options: { preset: "report" as const, toc: true, tocPageBreak: "auto" as const },
    },
    {
      expected: [],
      label: "non-report auto",
      options: { preset: "wide-table" as const, toc: true, tocPageBreak: "auto" as const },
    },
  ])("keeps the current named-page transition for $label", ({ expected, options }) => {
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(options));
    const transitions = Array.from(recipe.styleCss.match(/break-(?:before|after): page;/g) ?? []);

    expect(recipe.styleCss).toContain("#TOC {\n  page: toc;");
    expect(transitions).toEqual(Array.from(expected));
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
    expect(recipe.styleCss).toContain(`@bottom-center {\n    content: "Page " ${logicalCurrent};`);
    expect(recipe.styleCss).toContain("@page toc");
    expect(recipe.styleCss).not.toContain("counter(pages)");
  });

  test("keeps the page-chrome font family later than area typography longhands", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: { pageChrome: { default: "Profile Chrome" } },
        header: {
          left: "Header",
          style: { fontSize: "8.5pt", fontWeight: 600 },
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    const typographyIndex = recipe.styleCss.indexOf("font-size: 8.5pt;");
    const fontFamilyIndex = recipe.styleCss.indexOf(
      '@page {\n  font-family: "Profile Chrome", sans-serif;',
    );
    expect(typographyIndex).toBeGreaterThanOrEqual(0);
    expect(fontFamilyIndex).toBeGreaterThan(typographyIndex);
  });

  test("keeps page numbers disabled by default", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {},
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).not.toContain(logicalCurrent);
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

    expect(recipe.styleCss).toContain(`@top-right {\n    content: ${logicalCurrent};`);
    expect(recipe.styleCss).not.toContain(`@bottom-center {\n    content: ${logicalCurrent};`);
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
    expect(recipe.templateHtml.match(/Example Co\./g)).toHaveLength(1);
    expect(recipe.templateHtml).toContain('<p class="pdf-cover__company">Example Co.</p>');
    expect(recipe.templateHtml).toContain("Noname | 2026-05-07");
    expect(recipe.styleCss).toContain("@page cover");
    expect(recipe.styleCss).toContain("@top-left {\n    content: none;");
    expect(recipe.styleCss).toContain("@bottom-center {\n    content: none;");
    expect(recipe.styleCss).toContain(".pdf-cover");
  });

  test("escapes HTML-sensitive cover metadata and custom fields without duplicating company", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        metadata: {
          customCredit: 'Author <One> & "Team"',
        },
        cover: {
          enabled: true,
          fields: {
            title: "{title}",
            subtitle: 'Custom <subtitle> & "quoted"',
            author: "{customCredit}",
            company: "{company}",
            date: "",
          },
        },
      },
      frontmatter: {
        title: 'R&D <Q1> "Brief"',
        company: 'A&B <Co> "Lab"',
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });
    const escapedCompany = "A&amp;B &lt;Co&gt; &quot;Lab&quot;";

    expect(recipe.templateHtml).toContain("R&amp;D &lt;Q1&gt; &quot;Brief&quot;");
    expect(recipe.templateHtml).toContain("Custom &lt;subtitle&gt; &amp; &quot;quoted&quot;");
    expect(recipe.templateHtml).toContain("Author &lt;One&gt; &amp; &quot;Team&quot;");
    expect(recipe.templateHtml.match(new RegExp(escapedCompany, "g"))).toHaveLength(1);
    expect(recipe.templateHtml).toContain(`<p class="pdf-cover__company">${escapedCompany}</p>`);
    expect(recipe.templateHtml).not.toContain('R&D <Q1> "Brief"');
    expect(recipe.templateHtml).not.toContain('A&B <Co> "Lab"');
  });

  test("suppresses duplicate metadata title block when titleBlock mode is auto", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        titleBlock: {
          metadataTitle: "auto",
        },
      },
      frontmatter: {
        title: "CJK Font Smoke",
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
      titleSignals: {
        frontmatterTitle: { present: true, charCount: "CJK Font Smoke".length },
        firstH1: { present: true, charCount: "CJK Font Smoke".length },
        normalizedTitleMatch: true,
        duplicateVisibleTitleRisk: true,
      },
    });

    expect(recipe.templateHtml).not.toContain('class="document-title"');
    expect(recipe.templateHtml).toContain("$body$");
  });

  test("preserves explicit metadata title block rendering with titleBlock mode show", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        titleBlock: {
          metadataTitle: "show",
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
      titleSignals: {
        frontmatterTitle: { present: true, charCount: "CJK Font Smoke".length },
        firstH1: { present: true, charCount: "CJK Font Smoke".length },
        normalizedTitleMatch: true,
        duplicateVisibleTitleRisk: true,
      },
    });

    expect(recipe.templateHtml).toContain('class="document-title"');
    expect(recipe.templateHtml).toContain('<h1 class="title">$title$</h1>');
    const bodyIndex = recipe.templateHtml.indexOf('<main class="document-body">');
    const titleIndex = recipe.templateHtml.indexOf('class="document-title"');
    const bodyContentIndex = recipe.templateHtml.indexOf("$body$");
    expect(recipe.templateHtml).not.toContain('class="pdf-cover');
    expect(recipe.templateHtml.match(/<main class="document-body">/g)).toHaveLength(1);
    expect(bodyIndex).toBeLessThan(titleIndex);
    expect(titleIndex).toBeLessThan(bodyContentIndex);
  });

  test("suppresses metadata title block with titleBlock mode hide", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        cover: {
          enabled: true,
        },
        titleBlock: {
          metadataTitle: "hide",
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.templateHtml).not.toContain('class="document-title"');
    expect(recipe.templateHtml).toContain('class="pdf-cover pdf-cover--plain"');
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
