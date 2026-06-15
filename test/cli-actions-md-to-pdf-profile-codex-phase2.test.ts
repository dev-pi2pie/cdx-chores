import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createMarkdownPdfProfileCandidates,
  loadMarkdownPdfBaseProfileCandidate,
} from "../src/cli/markdown-pdf/profile/candidates";
import {
  MARKDOWN_PDF_SIGNAL_CODE_LANGUAGE_LIMIT,
  MARKDOWN_PDF_SIGNAL_FONT_FAMILY_LIMIT,
  MARKDOWN_PDF_SIGNAL_TABLE_ROW_LIMIT,
  MARKDOWN_PDF_SIGNAL_TEXT_LIMIT,
  collectMarkdownPdfDocumentSignals,
  collectMarkdownPdfFontSignals,
} from "../src/cli/markdown-pdf/profile/signals";
import { normalizeMarkdownPdfProfile } from "../src/cli/markdown-pdf";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("markdown PDF Codex profile phase 2 candidates and signals", () => {
  test("builds distinct default and preset-backed candidates", () => {
    const candidates = createMarkdownPdfProfileCandidates();
    const defaultCandidate = candidates.find((candidate) => candidate.summary.id === "default");
    const articleCandidate = candidates.find((candidate) => candidate.summary.id === "article");
    const wideTableCandidate = candidates.find(
      (candidate) => candidate.summary.id === "wide-table",
    );

    expect(defaultCandidate?.summary).toMatchObject({
      kind: "default",
      presetBacked: false,
    });
    expect(defaultCandidate?.summary.preset).toBeUndefined();
    expect(articleCandidate?.summary).toMatchObject({
      kind: "preset",
      presetBacked: true,
      preset: "article",
    });
    expect(wideTableCandidate?.summary).toMatchObject({
      kind: "preset",
      presetBacked: true,
      preset: "wide-table",
    });
    expect(wideTableCandidate?.fullProfile.page).toMatchObject({
      orientation: "landscape",
      marginTop: "12mm",
    });
  });

  test("loads valid base profiles and rejects invalid base profiles", async () => {
    await withTempFixtureDir("md-pdf-profile-base-candidate", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const legacyPath = join(fixtureDir, "legacy.yml");
      const invalidPath = join(fixtureDir, "invalid.yml");
      await writeFile(
        basePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: wide-table",
          "  preset: wide-table",
          "  createdAt: 2026-06-15T08:15:00Z",
          "page:",
          "  orientation: landscape",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(invalidPath, "page:\n  unexpected: true\n", "utf8");
      await writeFile(
        legacyPath,
        ["page:", "  size: Letter", "fonts:", "  body:", "    default: Source Serif 4", ""].join(
          "\n",
        ),
        "utf8",
      );

      const candidate = await loadMarkdownPdfBaseProfileCandidate({
        path: toRepoRelativePath(basePath),
      });

      expect(candidate.summary).toMatchObject({
        kind: "base-profile",
        presetBacked: true,
        preset: "wide-table",
        basedOn: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
      });
      expect(candidate.summary.traits).toMatchObject({
        bestFor: ["user supplied base profile"],
        density: "wide",
      });
      expect(candidate.summary.traits.bestFor).not.toContain("wide tables");
      expect(candidate.identity?.id).toBe("md-pdf-profile-20260615T081500Z-a1b2c3d4");

      const legacyCandidate = await loadMarkdownPdfBaseProfileCandidate({
        path: toRepoRelativePath(legacyPath),
      });
      expect(legacyCandidate.summary).toMatchObject({
        kind: "base-profile",
        presetBacked: false,
        preset: undefined,
        basedOn: "untracked-base-profile",
      });
      expect(legacyCandidate.identity).toBeUndefined();

      await expectCliError(
        () => loadMarkdownPdfBaseProfileCandidate({ path: toRepoRelativePath(invalidPath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown Markdown PDF profile key",
        },
      );
    });
  });

  test("collects bounded Markdown signals without raw snippets or URLs", () => {
    const tableRows = Array.from(
      { length: MARKDOWN_PDF_SIGNAL_TABLE_ROW_LIMIT + 5 },
      (_, index) => `| ${index} | ${index + 1} | ${index + 2} |`,
    ).join("\n");
    const fences = Array.from({ length: MARKDOWN_PDF_SIGNAL_CODE_LANGUAGE_LIMIT + 2 }, (_, index) =>
      [`\`\`\`lang${index}`, "content", "```"].join("\n"),
    ).join("\n");
    const markdown = [
      "---",
      "lang: zh-Hant",
      "title: Private Report",
      "pdf:",
      "  content-langs:",
      "    - zh-Hant",
      "---",
      "# Title",
      "## Section",
      "![remote](https://example.com/private/chart.png)",
      "![local](./images/chart.png)",
      '<img src="data:image/png;base64,abc">',
      tableRows,
      fences,
      "```",
      "secret_token = 'do-not-send'",
      "```",
      "```lang0",
      "duplicate body",
      "```",
      "漢".repeat(MARKDOWN_PDF_SIGNAL_TEXT_LIMIT + 10),
    ].join("\n\n");

    const signals = collectMarkdownPdfDocumentSignals(markdown);
    const serialized = JSON.stringify(signals);

    expect(signals.headings).toMatchObject({
      total: 2,
      maxDepth: 2,
      byDepth: { "1": 1, "2": 1 },
    });
    expect(signals.tables).toMatchObject({
      scannedRows: MARKDOWN_PDF_SIGNAL_TABLE_ROW_LIMIT,
      maxColumns: 3,
      overflowRows: 5,
    });
    expect(signals.codeFences.languages).toHaveLength(MARKDOWN_PDF_SIGNAL_CODE_LANGUAGE_LIMIT);
    expect(signals.codeFences.overflowLanguageCount).toBe(2);
    expect(signals.codeFences.unlabeledCount).toBe(1);
    expect(signals.codeFences.languages.filter((language) => language === "lang0")).toHaveLength(1);
    expect(signals.assets).toEqual({ localCount: 1, remoteCount: 1, dataUriCount: 1 });
    expect(signals.frontmatter).toEqual({
      lang: "zh-Hant",
      pdfContentLangs: ["zh-Hant"],
      metadataKeys: ["title"],
    });
    expect(signals.scripts.truncated).toBe(true);
    expect(signals.scripts.scannedChars).toBe(MARKDOWN_PDF_SIGNAL_TEXT_LIMIT);
    expect(signals.scripts.buckets.han).toBeGreaterThan(0);
    expect(serialized).not.toContain("https://example.com/private/chart.png");
    expect(serialized).not.toContain("./images/chart.png");
    expect(serialized).not.toContain("secret_token");
    expect(serialized).not.toContain("duplicate body");
    expect(serialized).not.toContain("Private Report");
  });

  test("collects bounded font summaries without font paths", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: {
            default: "Source Serif 4",
            "zh-Hant": "Noto Serif TC",
          },
          code: {
            default: "JetBrains Mono",
            symbols: "Symbols Nerd Font",
          },
        },
        pdf: {
          "content-langs": ["zh-Hant"],
        },
      },
    }).profile;

    const signals = collectMarkdownPdfFontSignals({
      profile: normalizedProfile,
      inventories: [
        {
          family: "Noto Serif TC",
          supportedRanges: [{ name: "CJK", start: 0x4e00, end: 0x9fff }],
        },
        {
          family: "Symbols Nerd Font",
          nerdFont: true,
          supportedCodepoints: [0xe0b0],
        },
      ],
    });
    const serialized = JSON.stringify(signals);

    expect(signals.families).toContainEqual(
      expect.objectContaining({
        role: "body",
        key: "zh-Hant",
        family: "Noto Serif TC",
        coverageStatus: "known",
        supportsText: true,
      }),
    );
    expect(signals.families).toContainEqual(
      expect.objectContaining({
        role: "code",
        key: "symbols",
        family: "Symbols Nerd Font",
      }),
    );
    expect(serialized).not.toContain("/Library/Fonts");
    expect(serialized).not.toContain("C:\\");
  });

  test("reports empty document signals and unknown font coverage as bounded summaries", () => {
    const documentSignals = collectMarkdownPdfDocumentSignals("");
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: {
            "zh-Hant": "Uninspected Serif",
          },
        },
        pdf: {
          "content-langs": ["zh-Hant"],
        },
      },
    }).profile;
    const fontSignals = collectMarkdownPdfFontSignals({ profile: normalizedProfile });

    expect(documentSignals.headings.total).toBe(0);
    expect(documentSignals.tables.scannedRows).toBe(0);
    expect(documentSignals.codeFences.languages).toEqual([]);
    expect(documentSignals.scripts).toEqual({
      scannedChars: 0,
      truncated: false,
      buckets: {},
    });
    expect(fontSignals.families).toContainEqual(
      expect.objectContaining({
        role: "body",
        key: "zh-Hant",
        family: "Uninspected Serif",
        coverageStatus: "unknown",
        supportsText: false,
      }),
    );
  });

  test("caps font family summaries and reports overflow", () => {
    const headingFonts = Object.fromEntries(
      Array.from({ length: MARKDOWN_PDF_SIGNAL_FONT_FAMILY_LIMIT + 3 }, (_, index) => [
        `heading-${index}`,
        `Family ${index}`,
      ]),
    );
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          heading: headingFonts,
        },
      },
    }).profile;

    const signals = collectMarkdownPdfFontSignals({ profile: normalizedProfile });

    expect(signals.families).toHaveLength(MARKDOWN_PDF_SIGNAL_FONT_FAMILY_LIMIT);
    expect(signals.overflowFamilyCount).toBe(3);
    expect(signals.families.at(0)).toMatchObject({
      role: "heading",
      key: "heading-0",
      family: "Family 0",
    });
  });
});
