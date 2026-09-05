import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  discoverMarkdownPdfRenderBundle,
  resolveMarkdownPdfRenderBundleInputs,
} from "../../../src/cli/markdown-pdf";
import { expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("Markdown PDF render bundle resolution", () => {
  test("resolves one candidate per available role with bundle provenance", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-resolve", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "template.html");
      const cssPath = join(fixtureDir, "style.css");
      await writeFile(profilePath, "page: {}\n", "utf8");
      await writeFile(templatePath, "$body$\n", "utf8");
      await writeFile(cssPath, "body {}\n", "utf8");

      const candidates = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(resolveMarkdownPdfRenderBundleInputs(candidates)).toEqual({
        profile: { path: profilePath, source: "bundle" },
        template: { path: templatePath, source: "bundle" },
        css: { path: cssPath, source: "bundle" },
      });
    });
  });

  test("uses explicit paths to resolve ambiguous roles and discovers the rest", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-explicit", async (fixtureDir) => {
      const externalTemplate = join(fixtureDir, "..", "selected-template.html");
      const cssPath = join(fixtureDir, "style.css");
      await writeFile(join(fixtureDir, "compact.html"), "$body$\n", "utf8");
      await writeFile(join(fixtureDir, "detailed.html"), "$body$\n", "utf8");
      await writeFile(cssPath, "body {}\n", "utf8");

      const candidates = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(
        resolveMarkdownPdfRenderBundleInputs(candidates, { template: externalTemplate }),
      ).toEqual({
        template: { path: externalTemplate, source: "explicit" },
        css: { path: cssPath, source: "bundle" },
      });
    });
  });

  test("allows explicit selection to resolve the only represented bundle role", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-explicit-only", async (fixtureDir) => {
      const selectedTemplate = join(fixtureDir, "detailed.html");
      await writeFile(join(fixtureDir, "compact.html"), "$body$\n", "utf8");
      await writeFile(selectedTemplate, "$body$\n", "utf8");

      const candidates = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(
        resolveMarkdownPdfRenderBundleInputs(candidates, { template: selectedTemplate }),
      ).toEqual({
        template: { path: selectedTemplate, source: "explicit" },
      });
    });
  });

  test("allows explicit selection to resolve every ambiguous bundle role", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-explicit-all", async (fixtureDir) => {
      const selectedProfile = join(fixtureDir, "profile-b.yml");
      const selectedTemplate = join(fixtureDir, "template-b.html");
      const selectedCss = join(fixtureDir, "style-b.css");
      for (const filename of [
        "profile-a.yml",
        "profile-b.yml",
        "template-a.html",
        "template-b.html",
        "style-a.css",
        "style-b.css",
      ]) {
        const content = filename.endsWith(".yml") ? "page: {}\n" : "artifact\n";
        await writeFile(join(fixtureDir, filename), content, "utf8");
      }

      const candidates = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(
        resolveMarkdownPdfRenderBundleInputs(candidates, {
          profile: selectedProfile,
          template: selectedTemplate,
          css: selectedCss,
        }),
      ).toEqual({
        profile: { path: selectedProfile, source: "explicit" },
        template: { path: selectedTemplate, source: "explicit" },
        css: { path: selectedCss, source: "explicit" },
      });
    });
  });

  test("reports every unresolved ambiguous role in stable order", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-conflicts", async (fixtureDir) => {
      for (const filename of [
        "z-profile.yml",
        "a-profile.yml",
        "z-template.html",
        "a-template.html",
        "z-style.css",
        "a-style.css",
      ]) {
        const content = filename.endsWith(".yml") ? "page: {}\n" : "artifact\n";
        await writeFile(join(fixtureDir, filename), content, "utf8");
      }

      const candidates = await discoverMarkdownPdfRenderBundle(fixtureDir);
      const error = await expectCliError(
        async () =>
          resolveMarkdownPdfRenderBundleInputs(candidates, {}, { displayDirectory: "./bundle" }),
        {
          code: "MARKDOWN_PDF_BUNDLE_AMBIGUOUS",
          exitCode: 2,
          messageIncludes: "Ambiguous Markdown PDF bundle: ./bundle",
        },
      );

      expect(error.message).toContain(
        [
          "Multiple profile candidates were found:",
          "- a-profile.yml",
          "- z-profile.yml",
          "",
          "Select one with --profile <path>, or remove the extra candidate.",
        ].join("\n"),
      );
      expect(error.message).toContain("Select one with --template <path>");
      expect(error.message).toContain("Select one with --css <path>");
      expect(error.message.indexOf("Multiple profile")).toBeLessThan(
        error.message.indexOf("Multiple template"),
      );
      expect(error.message.indexOf("Multiple template")).toBeLessThan(
        error.message.indexOf("Multiple stylesheet"),
      );
    });
  });
});
