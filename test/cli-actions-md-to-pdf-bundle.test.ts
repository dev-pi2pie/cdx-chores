import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  discoverMarkdownPdfRenderBundle,
  resolveMarkdownPdfRenderBundleInputs,
} from "../src/cli/markdown-pdf";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function candidateNames(input: Awaited<ReturnType<typeof discoverMarkdownPdfRenderBundle>>) {
  return {
    profile: input.profile.map((candidate) => candidate.basename),
    template: input.template.map((candidate) => candidate.basename),
    css: input.css.map((candidate) => candidate.basename),
  };
}

describe("Markdown PDF render bundle discovery", () => {
  test.each([
    ["profile", "report.YAML", { profile: ["report.YAML"], template: [], css: [] }],
    ["template", "template.HTML", { profile: [], template: ["template.HTML"], css: [] }],
    ["stylesheet", "print.CSS", { profile: [], template: [], css: ["print.CSS"] }],
  ] as const)("discovers a single %s artifact", async (_label, filename, expected) => {
    await withTempFixtureDir("md-pdf-render-bundle-single", async (fixtureDir) => {
      await writeFile(join(fixtureDir, filename), "artifact\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result)).toEqual(expected);
    });
  });

  test("discovers top-level candidates in stable order and ignores nested assets", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-complete", async (fixtureDir) => {
      await mkdir(join(fixtureDir, "assets"));
      await writeFile(join(fixtureDir, "z-profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "a-profile.json"), "{}\n", "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");
      await writeFile(join(fixtureDir, "style.css"), "body {}\n", "utf8");
      await writeFile(join(fixtureDir, "assets", "nested.css"), "body {}\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result)).toEqual({
        profile: ["a-profile.json", "z-profile.yml"],
        template: ["template.html"],
        css: ["style.css"],
      });
    });
  });

  test("excludes generated report filenames even when their JSON is malformed", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-report-names", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "profile-codex-report.json"), "not-json\n", "utf8");
      await writeFile(join(fixtureDir, "project.codex-report.json"), "not-json\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["profile.yml"]);
    });
  });

  test.each([
    ["profile", { artifact: { type: "markdown-pdf-codex-profile-report" } }],
    ["template", { artifactType: "markdown-pdf-codex-template-report" }],
    ["project", { artifactType: "markdown-pdf-codex-project-report" }],
  ])("excludes a custom-path %s Codex report by payload", async (_label, payload) => {
    await withTempFixtureDir("md-pdf-render-bundle-report-payload", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "custom.json"), `${JSON.stringify(payload)}\n`, "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["profile.yml"]);
    });
  });

  test.each([
    ["profile type in artifactType", { artifactType: "markdown-pdf-codex-profile-report" }],
    [
      "template type in artifact.type",
      { artifact: { type: "markdown-pdf-codex-template-report" } },
    ],
    ["project type in artifact.type", { artifact: { type: "markdown-pdf-codex-project-report" } }],
  ])("keeps an unrelated cross-field %s as a profile candidate", async (_label, payload) => {
    await withTempFixtureDir("md-pdf-render-bundle-report-cross-field", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cross-field.json"), `${JSON.stringify(payload)}\n`, "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["cross-field.json"]);
    });
  });

  test("keeps oversized custom JSON as a profile candidate without report classification", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-large-json", async (fixtureDir) => {
      const payload = {
        artifactType: "markdown-pdf-codex-template-report",
        padding: "x".repeat(64 * 1024),
      };
      await writeFile(join(fixtureDir, "large.json"), `${JSON.stringify(payload)}\n`, "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["large.json"]);
    });
  });

  test("keeps malformed and unrelated JSON as profile candidates", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-json", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "broken.json"), "not-json\n", "utf8");
      await writeFile(join(fixtureDir, "unrelated.json"), '{"kind":"other"}\n', "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["broken.json", "unrelated.json"]);
    });
  });

  test("rejects missing bundle directories", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-missing", async (fixtureDir) => {
      await expectCliError(() => discoverMarkdownPdfRenderBundle(join(fixtureDir, "missing")), {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
        messageIncludes: "Markdown PDF bundle directory not found",
      });
    });
  });

  test("rejects bundle paths that are not directories", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-file", async (fixtureDir) => {
      const filePath = join(fixtureDir, "bundle.html");
      await writeFile(filePath, "$body$\n", "utf8");

      await expectCliError(() => discoverMarkdownPdfRenderBundle(filePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Markdown PDF bundle path is not a directory",
      });
    });
  });

  test.each([
    ["empty", undefined],
    ["unrecognized", "notes.txt"],
  ])("rejects %s bundles", async (_label, filename) => {
    await withTempFixtureDir("md-pdf-render-bundle-empty", async (fixtureDir) => {
      if (filename) {
        await writeFile(join(fixtureDir, filename), "notes\n", "utf8");
      }

      await expectCliError(() => discoverMarkdownPdfRenderBundle(fixtureDir), {
        code: "MARKDOWN_PDF_BUNDLE_EMPTY",
        exitCode: 2,
        messageIncludes: "No Markdown PDF render artifacts found in bundle",
      });
    });
  });
});

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
        await writeFile(join(fixtureDir, filename), "artifact\n", "utf8");
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
        await writeFile(join(fixtureDir, filename), "artifact\n", "utf8");
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
