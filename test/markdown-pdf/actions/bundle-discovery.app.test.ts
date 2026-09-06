import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  discoverMarkdownPdfRenderBundle,
  previewMarkdownPdfRenderBundle,
} from "../../../src/cli/markdown-pdf";
import { expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";

function candidateNames(input: Awaited<ReturnType<typeof discoverMarkdownPdfRenderBundle>>) {
  return {
    profile: input.profile.map((candidate) => candidate.basename),
    template: input.template.map((candidate) => candidate.basename),
    css: input.css.map((candidate) => candidate.basename),
  };
}

describe("Markdown PDF render bundle discovery", () => {
  test.each([
    ["profile", "report.YAML", "page: {}\n", { profile: ["report.YAML"], template: [], css: [] }],
    [
      "template",
      "template.HTML",
      "$body$\n",
      { profile: [], template: ["template.HTML"], css: [] },
    ],
    ["stylesheet", "print.CSS", "body {}\n", { profile: [], template: [], css: ["print.CSS"] }],
  ] as const)("discovers a single %s artifact", async (_label, filename, content, expected) => {
    await withTempFixtureDir("md-pdf-render-bundle-single", async (fixtureDir) => {
      await writeFile(join(fixtureDir, filename), content, "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result)).toEqual({
        profile: [...expected.profile],
        template: [...expected.template],
        css: [...expected.css],
      });
    });
  });

  test("discovers top-level candidates in stable order and ignores nested assets", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-complete", async (fixtureDir) => {
      await mkdir(join(fixtureDir, "assets"));
      await writeFile(join(fixtureDir, "z-profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "a-profile.json"), '{"toc":{}}\n', "utf8");
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

  test("skips profile discovery when an explicit profile resolves the role and another artifact exists", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-resolved-profile", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir, {
        profileResolved: true,
      });

      expect(candidateNames(result)).toEqual({
        profile: [],
        template: ["template.html"],
        css: [],
      });
      expect(result.ignoredProfileFiles).toEqual([]);
    });
  });

  test("keeps profile-only bundle admission when an explicit profile resolves the role", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-resolved-profile-only", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir, {
        profileResolved: true,
      });

      expect(candidateNames(result)).toEqual({
        profile: ["profile.yml"],
        template: [],
        css: [],
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
  ])("ignores an unrelated cross-field %s", async (_label, payload) => {
    await withTempFixtureDir("md-pdf-render-bundle-report-cross-field", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cross-field.json"), `${JSON.stringify(payload)}\n`, "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual([]);
      expect(result.ignoredProfileFiles).toEqual(["cross-field.json"]);
    });
  });

  test("ignores oversized custom JSON when bounded report classification cannot admit it", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-large-json", async (fixtureDir) => {
      const payload = {
        artifactType: "markdown-pdf-codex-template-report",
        padding: "x".repeat(64 * 1024),
      };
      await writeFile(join(fixtureDir, "large.json"), `${JSON.stringify(payload)}\n`, "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual([]);
      expect(result.ignoredProfileFiles).toEqual(["large.json"]);
    });
  });

  test("keeps malformed and unrelated JSON out of profile candidate counting", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-json", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "broken.json"), "not-json\n", "utf8");
      await writeFile(join(fixtureDir, "unrelated.json"), '{"kind":"other"}\n', "utf8");
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["profile.yml"]);
      expect(result.ignoredProfileFiles).toEqual(["broken.json", "unrelated.json"]);
    });
  });

  test.each([
    ["malformed JSON", "broken.json", "{"],
    ["empty YAML document", "empty.yml", ""],
    ["null root", "null.json", "null\n"],
    ["array root", "array.yaml", "- page\n"],
    ["primitive root", "primitive.json", "1\n"],
    ["empty object", "empty.json", "{}\n"],
    ["multi-document YAML", "multi.yml", "page: {}\n---\ntoc: {}\n"],
    ["BOM-prefixed JSON", "bom.json", '\uFEFF{"page":{}}\n'],
    ["out-of-namespace object", "data.json", '{"rows":[]}\n'],
    ["mixed profile and outside keys", "mixed.yml", "page: {}\nrows: []\n"],
  ])("classifies %s as unclassified", async (_label, filename, content) => {
    await withTempFixtureDir("md-pdf-render-bundle-unclassified", async (fixtureDir) => {
      await writeFile(join(fixtureDir, filename), content, "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(result.profile).toEqual([]);
      expect(result.ignoredProfileFiles).toEqual([filename]);
    });
  });

  test("preserves YAML parser handling for a BOM-prefixed profile", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-yaml-bom", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "\uFEFFpage: {}\n", "utf8");

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["profile.yml"]);
      expect(result.ignoredProfileFiles).toEqual([]);
    });
  });

  test.each([
    ["structural", "page: true\n", "profile.page must be a plain object"],
    ["semantic", 'toc:\n  enabled: "yes"\n', "profile.toc.enabled must be a boolean"],
  ])(
    "rejects a profile-pattern match that fails %s validation",
    async (_label, content, message) => {
      await withTempFixtureDir("md-pdf-render-bundle-invalid-profile", async (fixtureDir) => {
        await writeFile(join(fixtureDir, "profile.yml"), content, "utf8");

        await expect(discoverMarkdownPdfRenderBundle(fixtureDir)).rejects.toThrow(message);
      });
    },
  );

  test("previews valid roles without rejecting invalid or empty profile candidates", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-preview", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "invalid-profile.yml"), "page: true\n", "utf8");
      await writeFile(join(fixtureDir, "notes.json"), '{"rows":[]}\n', "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");

      const result = await previewMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result)).toEqual({
        profile: [],
        template: ["template.html"],
        css: [],
      });
      expect(result.ignoredProfileFiles).toEqual(["notes.json"]);
    });
  });

  test("keeps all recognized Markdown PDF report forms silent beside a profile", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-all-reports", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(
        join(fixtureDir, "profile-report.json"),
        `${JSON.stringify({ artifact: { type: "markdown-pdf-codex-profile-report" } })}\n`,
        "utf8",
      );
      await writeFile(
        join(fixtureDir, "template-report.json"),
        `${JSON.stringify({ artifactType: "markdown-pdf-codex-template-report" })}\n`,
        "utf8",
      );
      await writeFile(
        join(fixtureDir, "project-report.json"),
        `${JSON.stringify({ artifactType: "markdown-pdf-codex-project-report" })}\n`,
        "utf8",
      );

      const result = await discoverMarkdownPdfRenderBundle(fixtureDir);

      expect(candidateNames(result).profile).toEqual(["profile.yml"]);
      expect(result.ignoredProfileFiles).toEqual([]);
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

  test("enriches an unclassified-only bundle error with stable filenames", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-unclassified-only", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "z-data.json"), '{"rows":[]}\n', "utf8");
      await writeFile(join(fixtureDir, "a-broken.yml"), ":\n", "utf8");

      const error = await expectCliError(() => discoverMarkdownPdfRenderBundle(fixtureDir), {
        code: "MARKDOWN_PDF_BUNDLE_EMPTY",
        exitCode: 2,
        messageIncludes: "Ignored unclassified YAML or JSON files:",
      });

      expect(error.message).toContain("- a-broken.yml\n- z-data.json");
    });
  });
});
