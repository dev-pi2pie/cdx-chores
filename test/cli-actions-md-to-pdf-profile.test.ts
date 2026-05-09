import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeMarkdownPdfProfile, readMarkdownPdfProfileFile } from "../src/cli/markdown-pdf";
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
            "zh-Hant": "Noto Serif CJK TC",
            ja: "Noto Serif CJK JP",
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
    expect(result.profile.fonts.body["zh-Hant"]).toBe("Noto Serif CJK TC");
    expect(result.profile.fonts.code.symbols).toBe("JetBrainsMono Nerd Font");
    expect(result.profile.contentLangs).toEqual(["zh-Hant", "ja", "ko"]);
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
