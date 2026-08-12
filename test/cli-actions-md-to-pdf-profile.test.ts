import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createMarkdownPdfProfileConfig,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
  readMarkdownPdfProfileFile,
  resolveMarkdownPdfCodeOptions,
  serializeMarkdownPdfProfile,
} from "../src/cli/markdown-pdf";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

describe("markdown PDF profile normalization", () => {
  test("merges profile metadata, frontmatter metadata, and CLI metadata overrides", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        page: {
          size: "Letter",
          margin: "12mm",
        },
        metadata: {
          company: "Example Co.",
          author: "Profile Author",
        },
        header: {
          left: "{company}",
          right: "{title}",
        },
        pageNumbers: {
          enabled: true,
        },
      },
      frontmatter: {
        title: "Quarterly Report",
        author: "Frontmatter Author",
      },
      meta: ["author=Noname"],
    });

    expect(result.recipeOptions).toMatchObject({
      pageSize: "Letter",
      margin: "12mm",
    });
    expect(result.profile.metadata).toMatchObject({
      company: "Example Co.",
      title: "Quarterly Report",
      author: "Noname",
    });
    expect(result.profile.header.left).toBe("{company}");
    expect(result.profile.pageNumbers).toMatchObject({
      enabled: true,
      position: "bottom-center",
      format: "{page}",
      scope: "body",
      countFrom: "document",
      start: 1,
      increment: 1,
    });
  });

  test("normalizes page-number sequence controls and preserves a zero start", () => {
    const defaults = normalizeMarkdownPdfProfile().profile;
    expect(defaults.pageNumbers).toEqual({
      enabled: false,
      position: "bottom-center",
      format: "{page}",
      scope: "body",
      countFrom: "document",
      start: 1,
      increment: 1,
    });

    const result = normalizeMarkdownPdfProfile({
      profile: {
        pageNumbers: {
          enabled: true,
          scope: "document",
          countFrom: "document",
          start: 0,
          increment: 2,
        },
      },
    });

    expect(result.profile.pageNumbers).toMatchObject({
      enabled: true,
      scope: "document",
      countFrom: "document",
      start: 0,
      increment: 2,
    });
  });

  test("normalizes bounded header and footer styles without inventing omitted fields", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        header: {
          left: "{title}",
          style: {
            fontSize: "6pt",
            fontWeight: 400,
            lineHeight: 1,
            color: "#A0b1C2",
            separator: {
              width: ".25pt",
              style: "solid",
              color: "#d0d5dd",
              gap: 0,
            },
          },
        },
        footer: {
          style: {
            fontSize: "12.0pt",
            fontWeight: 700,
            lineHeight: 2,
            separator: {
              width: "2.00pt",
              gap: "4.0mm",
            },
          },
        },
      },
    }).profile;

    expect(result.header).toEqual({
      left: "{title}",
      center: "",
      right: "",
      style: {
        fontSize: "6pt",
        fontWeight: 400,
        lineHeight: 1,
        color: "#A0b1C2",
        separator: {
          width: ".25pt",
          style: "solid",
          color: "#d0d5dd",
          gap: 0,
        },
      },
    });
    expect(result.footer.style).toEqual({
      fontSize: "12.0pt",
      fontWeight: 700,
      lineHeight: 2,
      separator: {
        width: "2.00pt",
        gap: "4.0mm",
      },
    });
    expect(normalizeMarkdownPdfProfile().profile.header).toEqual({
      left: "",
      center: "",
      right: "",
    });
  });

  test("accepts every inclusive page-chrome boundary and valid counting combination", () => {
    const styles = [
      {
        fontSize: "6pt",
        fontWeight: 400,
        lineHeight: 1,
        color: "#000000",
        separator: { width: ".25pt", style: "solid", color: "#aBcDeF", gap: 0 },
      },
      {
        fontSize: "12pt",
        fontWeight: 700,
        lineHeight: 2,
        color: "#FFFFFF",
        separator: { width: "2pt", style: "solid", color: "#123456", gap: "4mm" },
      },
    ] as const;

    for (const style of styles) {
      expect(
        normalizeMarkdownPdfProfile({ profile: { header: { style } } }).profile.header.style,
      ).toEqual(style);
    }

    for (const pageNumbers of [
      { scope: "document", countFrom: "document", start: 0, increment: 1 },
      { scope: "body", countFrom: "document", start: 1, increment: 2 },
      { scope: "body", countFrom: "body", start: 0, increment: 1 },
    ]) {
      expect(normalizeMarkdownPdfProfile({ profile: { pageNumbers } }).profile.pageNumbers).toEqual(
        expect.objectContaining(pageNumbers),
      );
    }
  });

  test("rejects invalid page-number sequence values and combinations", () => {
    const invalidCases: Array<{ message: string; pageNumbers: Record<string, unknown> }> = [
      { pageNumbers: { scope: "chapter" }, message: "scope must be one of" },
      { pageNumbers: { countFrom: "chapter" }, message: "countFrom must be one of" },
      {
        pageNumbers: { scope: "document", countFrom: "body" },
        message: "scope document cannot be used with countFrom body",
      },
      { pageNumbers: { start: -1 }, message: "start must be a non-negative integer" },
      { pageNumbers: { start: 1.5 }, message: "start must be an integer" },
      { pageNumbers: { increment: 0 }, message: "increment must be a positive integer" },
      { pageNumbers: { increment: 1.5 }, message: "increment must be an integer" },
    ];

    for (const invalidCase of invalidCases) {
      expect(() =>
        normalizeMarkdownPdfProfile({
          profile: { pageNumbers: invalidCase.pageNumbers },
        }),
      ).toThrow(invalidCase.message);
    }
  });

  test("rejects values outside the bounded page-chrome style domains", () => {
    const invalidCases: Array<{ message: string; style: Record<string, unknown> }> = [
      { style: { fontSize: "5.9pt" }, message: "fontSize must be a pt length" },
      { style: { fontSize: "8.55pt" }, message: "fontSize must be a pt length" },
      { style: { fontSize: "8px" }, message: "fontSize must be a pt length" },
      { style: { fontWeight: 450 }, message: "fontWeight must be one of" },
      { style: { lineHeight: 0 }, message: "lineHeight must be a number" },
      { style: { lineHeight: "1.2" }, message: "lineHeight must be a number" },
      { style: { color: "#abc" }, message: "color must be a six-digit" },
      {
        style: { separator: { width: "0pt" } },
        message: "separator.width must be a pt length",
      },
      {
        style: { separator: { width: "0.255pt" } },
        message: "separator.width must be a pt length",
      },
      {
        style: { separator: { style: "dashed" } },
        message: "separator.style must be solid",
      },
      {
        style: { separator: { color: "red" } },
        message: "separator.color must be a six-digit",
      },
      {
        style: { separator: { gap: "4.1mm" } },
        message: "separator.gap must be 0 or an mm length",
      },
      {
        style: { separator: { gap: "2.25mm" } },
        message: "separator.gap must be 0 or an mm length",
      },
    ];

    for (const invalidCase of invalidCases) {
      expect(() =>
        normalizeMarkdownPdfProfile({
          profile: { header: { style: invalidCase.style } },
        }),
      ).toThrow(invalidCase.message);
    }
  });

  test("preserves page-number and style zero values through YAML and JSON", async () => {
    const profile = {
      header: {
        style: {
          separator: {
            gap: 0,
          },
        },
      },
      pageNumbers: {
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
      },
    };

    await withTempFixtureDir("md-pdf-profile-page-number-zero", async (fixtureDir) => {
      for (const format of ["json", "yaml"] as const) {
        const extension = format === "json" ? "json" : "yml";
        const profilePath = join(fixtureDir, `profile.${extension}`);
        await writeFile(profilePath, serializeMarkdownPdfProfile(profile, format), "utf8");

        const loaded = await readMarkdownPdfProfileFile(profilePath);
        expect(loaded).toEqual(profile);
        const normalized = normalizeMarkdownPdfProfile({ profile: loaded }).profile;
        expect(normalized.pageNumbers.start).toBe(0);
        expect(normalized.header.style?.separator?.gap).toBe(0);
      }
    });
  });

  test("rejects unknown nested page-chrome and page-number keys", async () => {
    await withTempFixtureDir("md-pdf-profile-page-number-schema", async (fixtureDir) => {
      const cases = [
        {
          file: "style.yml",
          source: "header:\n  style:\n    fontFamily: serif\n",
          message: "profile.header.style.fontFamily",
        },
        {
          file: "separator.yml",
          source: "footer:\n  style:\n    separator:\n      radius: 1pt\n",
          message: "profile.footer.style.separator.radius",
        },
        {
          file: "page-numbers.yml",
          source: "pageNumbers:\n  style: {}\n",
          message: "profile.pageNumbers.style",
        },
      ];

      for (const invalidCase of cases) {
        const profilePath = join(fixtureDir, invalidCase.file);
        await writeFile(profilePath, invalidCase.source, "utf8");
        await expectCliError(() => readMarkdownPdfProfileFile(profilePath), {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: invalidCase.message,
        });
      }
    });
  });

  test("normalizes cover fields, profile fonts, and content languages", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        cover: {
          enabled: true,
          style: "report",
          fields: {
            title: "{company} Report",
          },
        },
        fonts: {
          body: {
            default: "Source Serif 4",
            "zh-Hant": "Noto Serif TC",
            ja: "Noto Serif JP",
          },
          code: {
            default: "JetBrains Mono",
            symbols: "JetBrainsMono Nerd Font",
          },
        },
        pdf: {
          "content-langs": ["zh-Hant", "ja"],
        },
      },
      frontmatter: {
        pdf: {
          "content-langs": ["ja", "ko"],
        },
      },
    });

    expect(result.profile.cover).toMatchObject({
      enabled: true,
      style: "report",
      fields: {
        title: "{company} Report",
        subtitle: "{subtitle}",
      },
    });
    expect(result.profile.fonts.body.default).toBe("Source Serif 4");
    expect(result.profile.fonts.body["zh-Hant"]).toBe("Noto Serif TC");
    expect(result.profile.fonts.code.symbols).toBe("JetBrainsMono Nerd Font");
    expect(result.profile.contentLangs).toEqual(["zh-Hant", "ja", "ko"]);
  });

  test("normalizes code highlighting settings", () => {
    const defaults = normalizeMarkdownPdfProfile();
    expect(defaults.profile.code).toEqual({
      highlight: false,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: false,
    });

    const result = normalizeMarkdownPdfProfile({
      profile: {
        code: {
          highlight: true,
          theme: "light-plus",
          lineNumbers: true,
          transformerNotation: true,
        },
      },
    });

    expect(result.profile.code).toEqual({
      highlight: true,
      theme: "light-plus",
      lineNumbers: true,
      transformerNotation: true,
    });
  });

  test("normalizes metadata title-block behavior", async () => {
    const defaults = normalizeMarkdownPdfProfile();
    expect(defaults.profile.titleBlock).toEqual({ metadataTitle: "auto" });

    const result = normalizeMarkdownPdfProfile({
      profile: {
        titleBlock: {
          metadataTitle: "hide",
        },
      },
    });
    expect(result.profile.titleBlock).toEqual({ metadataTitle: "hide" });

    await withTempFixtureDir("md-pdf-profile-title-block-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "titleBlock:\n  metadataTitle: duplicate\n", "utf8");

      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({ profile: await readMarkdownPdfProfileFile(profilePath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.titleBlock.metadataTitle must be one of",
        },
      );
    });
  });

  test("rejects unknown title-block profile keys", async () => {
    await withTempFixtureDir("md-pdf-profile-title-block-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "titleBlock:\n  title: hide\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(profilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.titleBlock.title",
      });
    });
  });

  test("normalizes profile identity and maps profile preset into recipe options", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        profile: {
          id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
          source: "codex",
          basedOn: "wide-table",
          preset: "wide-table",
          createdAt: "2026-06-15T08:15:00Z",
        },
      },
    });

    expect(result.profile.identity).toEqual({
      id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
      source: "codex",
      basedOn: "wide-table",
      preset: "wide-table",
      createdAt: "2026-06-15T08:15:00Z",
    });
    expect(result.recipeOptions.preset).toBe("wide-table");
  });

  test("normalizes deterministic profile identity sources", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        profile: {
          id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
          source: "deterministic",
          basedOn: "default",
          createdAt: "2026-06-15T08:15:00Z",
        },
      },
    });

    expect(result.profile.identity).toMatchObject({
      id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
      source: "deterministic",
      basedOn: "default",
      createdAt: "2026-06-15T08:15:00Z",
    });
  });

  test("keeps older profiles without profile identity valid", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        page: {
          size: "Letter",
        },
      },
    });

    expect(result.profile.identity).toBeUndefined();
    expect(result.recipeOptions).toMatchObject({
      pageSize: "Letter",
      preset: undefined,
    });
  });

  test("resolves CLI code highlight overrides after profile normalization", () => {
    const profile = normalizeMarkdownPdfProfile({
      profile: {
        code: {
          highlight: false,
          lineNumbers: true,
          transformerNotation: true,
        },
      },
    }).profile;

    expect(resolveMarkdownPdfCodeOptions({ profile: profile.code, cliHighlight: true })).toEqual({
      highlight: true,
      theme: "github-light",
      lineNumbers: true,
      transformerNotation: true,
    });
    expect(resolveMarkdownPdfCodeOptions({ profile: profile.code, cliHighlight: false })).toEqual({
      highlight: false,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: false,
    });
    expect(() => resolveMarkdownPdfCodeOptions({ profile: profile.code })).toThrow(
      "profile.code.lineNumbers requires code.highlight",
    );
  });

  test("rejects profile-only transformer notation without effective highlighting", () => {
    const profile = normalizeMarkdownPdfProfile({
      profile: {
        code: {
          transformerNotation: true,
        },
      },
    }).profile;

    expect(resolveMarkdownPdfCodeOptions({ profile: profile.code, cliHighlight: true })).toEqual({
      highlight: true,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: true,
    });
    expect(resolveMarkdownPdfCodeOptions({ profile: profile.code, cliHighlight: false })).toEqual({
      highlight: false,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: false,
    });
    expect(() => resolveMarkdownPdfCodeOptions({ profile: profile.code })).toThrow(
      "profile.code.transformerNotation requires code.highlight",
    );
  });

  test("rejects invalid code theme values", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "code:\n  theme: github-dark\n", "utf8");

      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({ profile: await readMarkdownPdfProfileFile(profilePath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.code.theme must be one of",
        },
      );
    });
  });

  test("rejects unknown code profile keys", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "code:\n  hilight: true\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(profilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.code.hilight",
      });
    });
  });

  test("rejects invalid profile identity values", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const sourcePath = join(fixtureDir, "bad-source.yml");
      const createdAtPath = join(fixtureDir, "bad-created-at.yml");
      const dateOnlyCreatedAtPath = join(fixtureDir, "date-only-created-at.yml");
      const invalidCalendarCreatedAtPath = join(fixtureDir, "invalid-calendar-created-at.yml");
      const idPath = join(fixtureDir, "bad-id.yml");
      const unknownKeyPath = join(fixtureDir, "unknown-identity-key.yml");
      await writeFile(
        profilePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  preset: slide-deck",
          "  createdAt: 2026-06-15T08:15:00Z",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        sourcePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: init",
          "  createdAt: 2026-06-15T08:15:00Z",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        createdAtPath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  createdAt: not-a-date",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        dateOnlyCreatedAtPath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  createdAt: 2026-06-15",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        invalidCalendarCreatedAtPath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  createdAt: 2026-02-31T08:15:00Z",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        idPath,
        [
          "profile:",
          "  id: profile-1",
          "  source: codex",
          "  createdAt: 2026-06-15T08:15:00Z",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        unknownKeyPath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  createdAt: 2026-06-15T08:15:00Z",
          "  cretedAt: 2026-06-15T08:15:00Z",
          "",
        ].join("\n"),
        "utf8",
      );

      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({ profile: await readMarkdownPdfProfileFile(profilePath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.profile.preset must be one of",
        },
      );
      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({ profile: await readMarkdownPdfProfileFile(sourcePath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.profile.source must be codex or deterministic",
        },
      );
      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({ profile: await readMarkdownPdfProfileFile(createdAtPath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.profile.createdAt must be an ISO date-time string",
        },
      );
      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({
            profile: await readMarkdownPdfProfileFile(dateOnlyCreatedAtPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.profile.createdAt must be an ISO date-time string",
        },
      );
      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({
            profile: await readMarkdownPdfProfileFile(invalidCalendarCreatedAtPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.profile.createdAt must be an ISO date-time string",
        },
      );
      await expectCliError(
        async () =>
          normalizeMarkdownPdfProfile({ profile: await readMarkdownPdfProfileFile(idPath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "profile.profile.id must use md-pdf-profile-YYYYMMDDTHHMMSSZ-xxxxxxxx",
        },
      );
      await expectCliError(() => readMarkdownPdfProfileFile(unknownKeyPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.profile.cretedAt",
      });
    });
  });

  test("rejects incomplete profile identity during normalization", () => {
    expect(() =>
      normalizeMarkdownPdfProfile({
        profile: {
          profile: {
            id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
            preset: "article",
          },
        },
      }),
    ).toThrow("profile.profile requires id, source, and createdAt");
    expect(() =>
      normalizeMarkdownPdfProfile({
        profile: {
          profile: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
        },
      }),
    ).toThrow("profile.profile must be a plain object");
  });

  test("rejects non-language keys in body font mappings", () => {
    expect(() =>
      normalizeMarkdownPdfProfile({
        profile: {
          fonts: {
            body: {
              fallback: "Noto Serif",
            },
          },
        },
      }),
    ).toThrow("profile.fonts.body.fallback must use default or a language tag");
  });

  test("rejects non-language body font keys while reading profile files", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "fonts:\n  body:\n    fallback: Noto Serif\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(profilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "profile.fonts.body.fallback must use default or a language tag",
      });
    });
  });

  test("rejects unknown profile keys", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "page:\n  unexpected: true\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(profilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.page.unexpected",
      });
    });
  });

  test("loads JSON profiles and rejects top-level unknown keys", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const jsonProfilePath = join(fixtureDir, "pdf-profile.json");
      const invalidProfilePath = join(fixtureDir, "invalid-profile.json");
      await writeFile(
        jsonProfilePath,
        JSON.stringify({
          page: {
            size: "Letter",
          },
          pageNumbers: {
            enabled: true,
          },
        }),
        "utf8",
      );
      await writeFile(invalidProfilePath, JSON.stringify({ unknown: true }), "utf8");

      const profile = await readMarkdownPdfProfileFile(jsonProfilePath);
      expect(profile.page).toEqual({ size: "Letter" });

      await expectCliError(() => readMarkdownPdfProfileFile(invalidProfilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.unknown",
      });
    });
  });

  test("serializes profile identity in JSON and YAML profiles", async () => {
    const profile = {
      profile: {
        id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
        source: "codex",
        basedOn: "article",
        preset: "article",
        createdAt: "2026-06-15T08:15:00Z",
      },
      page: {
        size: "A4",
      },
    };

    await withTempFixtureDir("md-pdf-profile-serialize", async (fixtureDir) => {
      const jsonPath = join(fixtureDir, "profile.json");
      const yamlPath = join(fixtureDir, "profile.yml");
      await writeFile(jsonPath, serializeMarkdownPdfProfile(profile, "json"), "utf8");
      await writeFile(yamlPath, serializeMarkdownPdfProfile(profile, "yaml"), "utf8");

      await expect(readMarkdownPdfProfileFile(jsonPath)).resolves.toEqual(profile);
      await expect(readMarkdownPdfProfileFile(yamlPath)).resolves.toEqual(profile);
    });
  });

  test("composes profile config with optional identity for generated profiles", () => {
    const identity = {
      id: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
      source: "codex" as const,
      basedOn: "wide-table",
      preset: "wide-table" as const,
      createdAt: "2026-06-15T08:15:00Z",
    };
    const profile = createMarkdownPdfProfileConfig(
      normalizeMarkdownPdfOptions({ preset: "wide-table" }),
      { identity },
    );

    expect(profile.profile).toEqual(identity);
    expect(profile.page).toMatchObject({
      orientation: "landscape",
      marginTop: "12mm",
    });
  });

  test("rejects malformed profile content and non-object roots", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const malformedJsonPath = join(fixtureDir, "malformed.json");
      const arrayYamlPath = join(fixtureDir, "array.yml");
      await writeFile(malformedJsonPath, "{", "utf8");
      await writeFile(arrayYamlPath, "- page\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(malformedJsonPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Failed to parse Markdown PDF profile JSON",
      });
      await expectCliError(() => readMarkdownPdfProfileFile(arrayYamlPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Markdown PDF profile must be a plain object",
      });
    });
  });
});
