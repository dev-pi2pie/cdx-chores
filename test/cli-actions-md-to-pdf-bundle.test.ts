import { describe, expect, test } from "bun:test";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { actionMdToPdf } from "../src/cli/actions";
import {
  discoverMarkdownPdfRenderBundle,
  resolveMarkdownPdfRenderBundleInputs,
  type MarkdownPdfProcessRunner,
} from "../src/cli/markdown-pdf";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { expectCliError } from "./helpers/cli-action-test-utils";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function candidateNames(input: Awaited<ReturnType<typeof discoverMarkdownPdfRenderBundle>>) {
  return {
    profile: input.profile.map((candidate) => candidate.basename),
    template: input.template.map((candidate) => candidate.basename),
    css: input.css.map((candidate) => candidate.basename),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
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

      expect(candidateNames(result)).toEqual(expected);
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

describe("Markdown PDF render bundle action integration", () => {
  test.each([
    {
      label: "profile-only",
      files: [["profile.yml", "page:\n  size: A4\n"]],
      expectedLines: ["- profile: profile.yml"],
    },
    {
      label: "template-only",
      files: [["template.html", "<html><body>$body$</body></html>\n"]],
      expectedLines: ["- template: template.html"],
    },
    {
      label: "stylesheet-only",
      files: [["style.css", "body { color: black; }\n"]],
      expectedLines: ["- css: style.css"],
    },
    {
      label: "partial",
      files: [
        ["template.html", "<html><body>$body$</body></html>\n"],
        ["style.css", "body { color: black; }\n"],
      ],
      expectedLines: ["- template: template.html", "- css: style.css"],
    },
    {
      label: "complete",
      files: [
        ["profile.yml", "page:\n  size: A4\n"],
        ["template.html", "<html><body>$body$</body></html>\n"],
        ["style.css", "body { color: black; }\n"],
        ["project.codex-report.json", "not-json\n"],
      ],
      expectedLines: ["- profile: profile.yml", "- template: template.html", "- css: style.css"],
    },
  ])("renders a $label bundle through the existing pipeline", async ({ files, expectedLines }) => {
    await withTempFixtureDir("md-pdf-render-bundle-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      for (const [filename, content] of files) {
        await writeFile(join(bundleDirectory, filename), content, "utf8");
      }
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(stdout.text).toContain("Resolved Markdown PDF bundle:");
      for (const line of expectedLines) {
        expect(stdout.text).toContain(line);
      }
      expect(stdout.text).toContain("Wrote PDF:");
      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(true);
      expectNoStderr();
    });
  });

  test("uses explicit paths to resolve bundle conflicts and reports their provenance", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-explicit", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      const explicitTemplate = join(fixtureDir, "selected.html");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "compact.html"), "$body$\n", "utf8");
      await writeFile(join(bundleDirectory, "detailed.html"), "$body$\n", "utf8");
      await writeFile(join(bundleDirectory, "style.css"), "body {}\n", "utf8");
      await writeFile(explicitTemplate, "<html><body>$body$</body></html>\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        template: toRepoRelativePath(explicitTemplate),
        runner,
      });

      expect(stdout.text).toContain(
        `- template: ${toRepoRelativePath(explicitTemplate)} (explicit)`,
      );
      expect(stdout.text).toContain("- css: style.css");
      expectNoStderr();
    });
  });

  test("rejects unresolved conflicts before dependency probes or output writes", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-conflict", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "compact.html"), "$body$\n", "utf8");
      await writeFile(join(bundleDirectory, "detailed.html"), "$body$\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            bundle: toRepoRelativePath(bundleDirectory),
            runner,
          }),
        {
          code: "MARKDOWN_PDF_BUNDLE_AMBIGUOUS",
          exitCode: 2,
          messageIncludes: "Select one with --template <path>",
        },
      );

      expect(calls).toHaveLength(0);
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(htmlOutputPath)).toBe(false);
      expectNoOutput();
    });
  });

  test("does not print a summary or probe dependencies when a selected profile is invalid", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-invalid", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "profile.yml"), "page: true\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          htmlOutput: toRepoRelativePath(htmlOutputPath),
          bundle: toRepoRelativePath(bundleDirectory),
          runner,
        }),
      ).rejects.toThrow("profile.page must be a plain object");

      expect(calls).toHaveLength(0);
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(htmlOutputPath)).toBe(false);
      expectNoOutput();
    });
  });

  test("prints one stable warning for ignored files without creating a false conflict", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-ignored", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(bundleDirectory, "z-data.json"), '{"rows":[]}\n', "utf8");
      await writeFile(join(bundleDirectory, "a-broken.yml"), ":\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        runner,
      });

      expect(await pathExists(outputPath)).toBe(true);
      expect(stderr.text).toBe(
        [
          "Warning: ignored unclassified YAML or JSON bundle files:",
          "- a-broken.yml",
          "- z-data.json",
          "",
        ].join("\n"),
      );
    });
  });

  test("keeps an explicitly selected in-bundle empty profile compatible without a warning", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-explicit-empty", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      const explicitProfilePath = join(bundleDirectory, "empty-profile.json");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(explicitProfilePath, "{}\n", "utf8");
      await writeFile(join(bundleDirectory, "template.html"), "$body$\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        profile: toRepoRelativePath(explicitProfilePath),
        runner,
      });

      expect(await pathExists(outputPath)).toBe(true);
      expectNoStderr();
    });
  });

  test("lets an explicit profile bypass invalid bundle profile admission", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-explicit-bypass", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const explicitProfilePath = join(fixtureDir, "selected-profile.yml");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(explicitProfilePath, "page: {}\n", "utf8");
      await writeFile(join(bundleDirectory, "broken-profile.yml"), "page: true\n", "utf8");
      await writeFile(join(bundleDirectory, "template.html"), "$body$\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        profile: toRepoRelativePath(explicitProfilePath),
        runner,
      });

      expect(await pathExists(outputPath)).toBe(true);
      expectNoStderr();
    });
  });

  if (process.platform !== "win32") {
    test("does not read unused bundle profiles after an explicit profile resolves the role", async () => {
      await withTempFixtureDir(
        "md-pdf-render-bundle-action-unreadable-profile",
        async (fixtureDir) => {
          const inputPath = join(fixtureDir, "report.md");
          const outputPath = join(fixtureDir, "report.pdf");
          const explicitProfilePath = join(fixtureDir, "selected-profile.yml");
          const bundleDirectory = join(fixtureDir, "bundle");
          const unusedProfilePath = join(bundleDirectory, "unused-profile.yml");
          await mkdir(bundleDirectory);
          await writeFile(inputPath, "# Report\n", "utf8");
          await writeFile(explicitProfilePath, "page: {}\n", "utf8");
          await writeFile(unusedProfilePath, "page: {}\n", "utf8");
          await writeFile(join(bundleDirectory, "template.html"), "$body$\n", "utf8");
          await chmod(unusedProfilePath, 0o000);
          const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
          const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

          try {
            await actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              output: toRepoRelativePath(outputPath),
              bundle: toRepoRelativePath(bundleDirectory),
              profile: toRepoRelativePath(explicitProfilePath),
              runner,
            });
          } finally {
            await chmod(unusedProfilePath, 0o600);
          }

          expect(await pathExists(outputPath)).toBe(true);
          expect(stdout.text).toContain("- profile:");
          expect(stdout.text).toContain("(explicit)");
          expect(stdout.text).toContain("- template: template.html");
          expect(stdout.text).not.toContain("unused-profile.yml");
          expectNoStderr();
        },
      );
    });
  }

  test("keeps unclassified-only failures side-effect free and emits no separate warning", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-unclassified", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "data.json"), '{"rows":[]}\n', "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            bundle: toRepoRelativePath(bundleDirectory),
            runner,
          }),
        {
          code: "MARKDOWN_PDF_BUNDLE_EMPTY",
          exitCode: 2,
          messageIncludes: "- data.json",
        },
      );

      expect(calls).toHaveLength(0);
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(htmlOutputPath)).toBe(false);
      expectNoOutput();
    });
  });

  test("preserves profile overrides, CSS order, and template-relative managed assets", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-complete", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      const templatePath = join(bundleDirectory, "template.html");
      const cssPath = join(bundleDirectory, "style.css");
      const coverPath = join(bundleDirectory, "assets", "cover.png");
      await mkdir(join(bundleDirectory, "assets"), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        join(bundleDirectory, "profile.yml"),
        "page:\n  orientation: portrait\n",
        "utf8",
      );
      await writeFile(
        templatePath,
        '<html><body><img src="assets/cover.png">$body$</body></html>\n',
        "utf8",
      );
      await writeFile(cssPath, ".bundle-style { color: black; }\n", "utf8");
      await writeFile(coverPath, "cover", "utf8");
      const renderedStyles: string[] = [];
      let rewrittenTemplate = "";
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const selectedTemplate = args[args.indexOf("--template") + 1];
          if (selectedTemplate) {
            rewrittenTemplate = await readFile(selectedTemplate, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((argument, index) => (argument === "--stylesheet" ? index : -1))
            .filter((index) => index >= 0);
          for (const index of stylesheetIndexes) {
            const stylesheetPath = args[index + 1];
            if (stylesheetPath) {
              renderedStyles.push(await readFile(stylesheetPath, "utf8"));
            }
          }
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        orientation: "landscape",
        runner: capturingRunner,
      });

      expect(rewrittenTemplate).toContain(`src="${pathToFileURL(coverPath).href}"`);
      expect(renderedStyles.join("\n")).toContain("size: A4 landscape");
      expect(renderedStyles.at(-1)).toContain(".bundle-style");
      const weasyprintCall = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintCall?.args).toContain(cssPath);
      expectNoStderr();
    });
  });

  test("preserves no-default-css and code-highlight overrides for bundle inputs", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-overrides", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      const cssPath = join(bundleDirectory, "style.css");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1; // [!code ++]\n```\n", "utf8");
      await writeFile(
        join(bundleDirectory, "profile.yml"),
        "code:\n  highlight: true\n  transformerNotation: true\n",
        "utf8",
      );
      await writeFile(cssPath, ".bundle-style { color: black; }\n", "utf8");
      const html =
        '<html><body><pre><code class="language-js">const x = 1; // [!code ++]</code></pre></body></html>';
      const { calls, runner } = createPdfRunner({ html });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        bundle: toRepoRelativePath(bundleDirectory),
        noDefaultCss: true,
        codeHighlight: false,
        runner,
      });

      expect(await readFile(htmlOutput, "utf8")).toBe(html);
      const weasyprintCall = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintCall?.args.filter((argument) => argument === "--stylesheet")).toHaveLength(
        1,
      );
      expect(weasyprintCall?.args).toContain(cssPath);
      expectNoStderr();
    });
  });
});
