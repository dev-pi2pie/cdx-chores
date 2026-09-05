import { describe, expect, test } from "bun:test";
import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
} from "../../../src/cli/markdown-pdf";
import { MARKDOWN_PDF_CODE_FONT_SELECTORS } from "../../../src/cli/markdown-pdf/code-style";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssRuleBody(css: string, selector: string): string {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  expect(match?.[1]).toBeDefined();
  return match?.[1] ?? "";
}

describe("Markdown PDF recipe font generation", () => {
  test("generates profile font fallback stacks and language CSS", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: {
            default: "Source Serif 4",
            "zh-Hant": "Noto Serif TC",
            ja: "Noto Serif JP",
            ko: "Noto Serif KR",
          },
          heading: {
            default: "Source Sans 3",
          },
          code: {
            default: "JetBrains Mono",
            symbols: "JetBrainsMono Nerd Font",
          },
          pageChrome: {
            default: "Source Sans 3",
          },
        },
      },
      frontmatter: {
        pdf: {
          "content-langs": ["zh-Hant", "zh-Hant", "ja"],
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).toContain(
      'font-family: "Source Serif 4", "Noto Serif TC", "Noto Serif JP", serif;',
    );
    expect(recipe.styleCss).toContain(
      ':lang(zh-Hant) {\n  font-family: "Noto Serif TC", "Source Serif 4", serif;',
    );
    expect(recipe.styleCss).toContain(
      ':lang(ja) {\n  font-family: "Noto Serif JP", "Source Serif 4", serif;',
    );
    expect(recipe.styleCss).toContain(
      ':lang(ko) {\n  font-family: "Noto Serif KR", "Source Serif 4", serif;',
    );
    expect(recipe.styleCss).toContain(`${MARKDOWN_PDF_CODE_FONT_SELECTORS} {`);
    expect(recipe.styleCss).toContain(
      'font-family: "JetBrains Mono", "JetBrainsMono Nerd Font", monospace;',
    );
    expect(recipe.styleCss).toContain('@page {\n  font-family: "Source Sans 3", sans-serif;');
    expect(recipe.styleCss.indexOf('"Source Serif 4"')).toBeLessThan(
      recipe.styleCss.indexOf('"Noto Serif TC"'),
    );
    expect(recipe.styleCss.match(/"Noto Serif TC"/g)).toHaveLength(2);
  });

  test("includes default code hook CSS for highlighted and numbered blocks", () => {
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions());

    expect(cssRuleBody(recipe.styleCss, "pre")).toContain("background:");
    expect(cssRuleBody(recipe.styleCss, "code")).toContain("font-family:");
    expect(cssRuleBody(recipe.styleCss, "pre.cdx-code--highlighted")).toContain("border-color:");
    expect(cssRuleBody(recipe.styleCss, "pre.cdx-code--numbered")).toContain("padding:");
    expect(cssRuleBody(recipe.styleCss, ".cdx-code-line-number")).toContain("text-align: right");
    expect(cssRuleBody(recipe.styleCss, ".cdx-code-line-content")).toContain("white-space:");
    expect(cssRuleBody(recipe.styleCss, ".cdx-code-line--highlighted")).toContain("background:");
    expect(cssRuleBody(recipe.styleCss, ".cdx-code-line--inserted")).toContain("background:");
    expect(cssRuleBody(recipe.styleCss, ".cdx-code-line--deleted")).toContain("background:");
  });

  test("generates expanded mixed-language CSS without assuming renderer RTL quality", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        fonts: {
          body: {
            default: "Source Serif 4",
            "zh-Hant": "Noto Serif TC",
            "zh-Hans": "Noto Serif SC",
            ja: "Noto Serif JP",
            ko: "Noto Serif KR",
            vi: "Source Serif Vietnamese",
            pl: "Source Serif Polish",
            ar: "Noto Naskh Arabic",
            he: "Noto Serif Hebrew",
          },
        },
        pdf: {
          "content-langs": ["zh-Hant", "zh-Hans", "ja", "ko", "vi", "pl", "ar", "he"],
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(normalizedProfile.profile.contentLangs).toEqual([
      "zh-Hant",
      "zh-Hans",
      "ja",
      "ko",
      "vi",
      "pl",
      "ar",
      "he",
    ]);
    expect(recipe.styleCss).toContain(
      'font-family: "Source Serif 4", "Noto Serif TC", "Noto Serif SC", "Noto Serif JP", "Noto Serif KR", "Source Serif Vietnamese", "Source Serif Polish", "Noto Naskh Arabic", "Noto Serif Hebrew", serif;',
    );
    expect(recipe.styleCss).toContain(":lang(zh-Hant)");
    expect(recipe.styleCss).toContain(":lang(zh-Hans)");
    expect(recipe.styleCss).toContain(":lang(ja)");
    expect(recipe.styleCss).toContain(":lang(ko)");
    expect(recipe.styleCss).toContain(":lang(vi)");
    expect(recipe.styleCss).toContain(":lang(pl)");
    expect(recipe.styleCss).toContain(":lang(ar)");
    expect(recipe.styleCss).toContain(":lang(he)");
  });
});
