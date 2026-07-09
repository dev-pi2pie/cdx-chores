import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { discoverMarkdownPdfRenderBundle } from "../src/cli/markdown-pdf";
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
