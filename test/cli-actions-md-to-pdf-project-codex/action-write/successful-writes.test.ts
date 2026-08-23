import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../../src/adapters/codex/markdown-pdf-profile";
import { actionMdPdfProjectCodex, actionMdToPdf } from "../../../src/cli/actions/markdown";
import type { MarkdownPdfProcessRunner } from "../../../src/cli/markdown-pdf";
import {
  validateMdPdfProjectBundleCompleteness,
  type MarkdownPdfProjectCodexReportArtifact,
} from "../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { createPdfRunner } from "../../markdown-pdf/actions/render-support";
import { minimalPng } from "../../markdown-pdf/actions/template-codex-fixtures";
import { pathExists } from "../../markdown-pdf/support/path-fixtures";

import {
  BASE_PROFILE,
  adaptedProfileRunner,
  adaptedTemplateResponse,
  expectPrivacySafeReport,
  stubTemplateRunner,
} from "../../markdown-pdf/actions/project-codex-action-write-fixtures";

function expectManagedProjectTemplateRoles(
  templateHtml: string,
  expected: { cover: boolean; metadataTitle: boolean },
): void {
  const coverIndex = templateHtml.indexOf('<section class="pdf-cover');
  const tocIndex = templateHtml.indexOf('<nav id="TOC" role="doc-toc">');
  const bodyIndex = templateHtml.indexOf('<main class="document-body">');
  const titleIndex = templateHtml.indexOf('<header class="document-title">');
  const bodyContentIndex = templateHtml.indexOf("$body$");

  expect(templateHtml).toContain("$if(toc)$");
  expect(tocIndex).toBeGreaterThanOrEqual(0);
  expect(templateHtml.match(/<main class="document-body">/g)).toHaveLength(1);
  expect(tocIndex).toBeLessThan(bodyIndex);
  expect(bodyIndex).toBeLessThan(bodyContentIndex);

  if (expected.cover) {
    expect(coverIndex).toBeGreaterThanOrEqual(0);
    expect(coverIndex).toBeLessThan(tocIndex);
  } else {
    expect(coverIndex).toBe(-1);
  }

  if (expected.metadataTitle) {
    expect(bodyIndex).toBeLessThan(titleIndex);
    expect(titleIndex).toBeLessThan(bodyContentIndex);
  } else {
    expect(titleIndex).toBe(-1);
  }
}

function profilePromptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("profile Codex prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

function duplicateTitleProfileRunner(): MarkdownPdfCodexProfileRunner {
  return async ({ prompt }) => {
    const facts = profilePromptFacts(prompt);
    expect(facts.titleDecisionSignal).toMatchObject({
      duplicateVisibleTitleRisk: true,
      supportedPatch: "/titleBlock/metadataTitle",
    });
    return JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: "article",
      accepted_patches: [{ op: "replace", path: "/titleBlock/metadataTitle", value: "auto" }],
      accepted_font_patches: [],
      reasoning: "The first H1 already provides the visible title.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
  };
}

describe("cli action modules: md pdf-project codex action writes", () => {
  test("writes validated project bundles and privacy-safe cover metadata", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-bundle-write", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(outputPath, "project.codex-report.json");
      const coverPath = join(fixtureDir, "cover.png");

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(coverPath, minimalPng(1200, 800));

      const { runtime, stderr, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        displayPathStyle: "absolute",
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        coverImage: "cover.png",
        output: "project-output",
        keepCodexReport: true,
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project signal mode: deterministic");
      expect(stdout.text).toContain("Final decision mode: deterministic");
      expect(stdout.text).toContain("Output directory: project-output");
      expect(stdout.text).toContain("Codex report: project-output/project.codex-report.json");
      expect(stdout.text).toContain("Managed assets: 1");
      expect(stdout.text).toContain("Project artifacts: written");
      expect(stdout.text).toContain("Follow-up render usability: usable");
      expect(stderr.text).toContain("Wrote Markdown PDF project bundle:");
      expect(stderr.text).toContain("project-output");
      expectPrivacySafeReport(stdout.text, fixtureDir);
      expectPrivacySafeReport(stderr.text, fixtureDir);
      expect(await readFile(join(outputPath, "profile.yml"), "utf8")).toContain("md-pdf-profile-");
      const templateHtml = await readFile(join(outputPath, "template.html"), "utf8");
      expectManagedProjectTemplateRoles(templateHtml, { cover: true, metadataTitle: false });
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
      expect(await pathExists(join(outputPath, "assets", "cover.png"))).toBe(true);

      const completeBundle = await validateMdPdfProjectBundleCompleteness(outputPath);
      expect(completeBundle).toMatchObject({
        assets: [join(outputPath, "assets", "cover.png")],
        css: join(outputPath, "style.css"),
        profile: join(outputPath, "profile.yml"),
        reports: [reportPath],
        template: join(outputPath, "template.html"),
      });

      const reportText = await readFile(reportPath, "utf8");
      expectPrivacySafeReport(reportText, fixtureDir);
      const report = JSON.parse(reportText) as {
        handoff: {
          artifacts: { availability: string };
          profile: { bundlePath: string; id: string };
          render: { usability: string; command?: unknown };
        };
        input: {
          coverImage: {
            dimensions: { height: number; width: number };
            source: { display: string; redacted: boolean };
          };
        };
        managedAssets: Array<{
          bundlePath: string;
          source: { display: string; redacted: boolean };
        }>;
      };
      expect(report.input.coverImage).toMatchObject({
        dimensions: { height: 800, width: 1200 },
        source: { display: "cover.png", redacted: true },
      });
      expect(report.managedAssets).toEqual([
        expect.objectContaining({
          bundlePath: "assets/cover.png",
          source: { display: "cover.png", basename: "cover.png", redacted: true },
        }),
      ]);
      expect(report.handoff).toMatchObject({
        profile: {
          id: "md-pdf-profile-20260704T080000Z-abc12345",
          bundlePath: "profile.yml",
        },
        artifacts: { availability: "written" },
        render: { usability: "usable" },
      });
    });
  });

  test("shows a usable written handoff after a successful bundle without a report", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-bundle-no-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        output: "project-output",
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project artifacts: written");
      expect(stdout.text).toContain("Follow-up render usability: usable");
      expect(stdout.text).not.toContain("Project artifacts: planned");
      expect(stdout.text).not.toContain("Follow-up render usability: planned");
      expect(stdout.text).not.toContain("Codex report:");
      expect(await pathExists(join(fixtureDir, "project-output", "profile.yml"))).toBe(true);
      const templatePath = join(fixtureDir, "project-output", "template.html");
      expect(await pathExists(templatePath)).toBe(true);
      expectManagedProjectTemplateRoles(await readFile(templatePath, "utf8"), {
        cover: false,
        metadataTitle: true,
      });
      expect(await pathExists(join(fixtureDir, "project-output", "style.css"))).toBe(true);
    });
  });

  test("reports successful profile-template validation without internal font ownership data", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-font-ownership-report",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");
        const reportPath = join(outputPath, "project.codex-report.json");
        const profileFontSentinel = "FULL_PROFILE_FONT_SENTINEL";
        const templateDecisionSentinel = "TEMPLATE_FONT_DECISION_SENTINEL";

        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "fonts:",
            "  body:",
            `    default: ${profileFontSentinel}`,
            "",
          ].join("\n"),
          "utf8",
        );

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        await actionMdPdfProjectCodex(runtime, {
          baseProfile: "base.yml",
          intent: "apply custom CSS",
          output: "project-output",
          keepCodexReport: true,
          profileCodexRunner: adaptedProfileRunner(),
          templateCodexRunner: stubTemplateRunner(
            adaptedTemplateResponse([
              {
                family: templateDecisionSentinel,
                key: "default",
                role: "body",
                source: "template-style",
                template_level: false,
              },
            ]),
          ),
          identityUidFactory: () => "abc12345",
        });

        const reportText = await readFile(reportPath, "utf8");
        const report = JSON.parse(reportText) as MarkdownPdfProjectCodexReportArtifact;
        expect(report.validationResults).toContainEqual({
          name: "profile-template-compatibility",
          status: "passed",
        });
        expect(report).not.toHaveProperty("fontOwnership");
        expect(report).not.toHaveProperty("ownedKeys");
        expect(report).not.toHaveProperty("normalizedProfile");
        expect(report.phases.profile).not.toHaveProperty("finalProfile");
        expect(report.phases.template).not.toHaveProperty("fontDecisions");
        expect(reportText).not.toContain('"fontOwnership"');
        expect(reportText).not.toContain('"ownedKeys"');
        expect(reportText).not.toContain('"normalizedProfile"');
        expect(reportText).not.toContain('"finalProfile"');
        expect(reportText).not.toContain('"fontDecisions"');
        expect(reportText).not.toContain(profileFontSentinel);
        expect(reportText).not.toContain(templateDecisionSentinel);
      },
    );
  });

  test("writes document-informed projects that suppress duplicate metadata titles", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-title-dedup", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "project-output");
      const reportPath = join(outputPath, "project.codex-report.json");

      await writeFile(
        join(fixtureDir, "cjk.md"),
        [
          "---",
          "title: CJK Font Smoke",
          "lang: en",
          "---",
          "",
          "# CJK Font Smoke",
          "",
          "This document checks mixed English, Japanese, Traditional Chinese, and code font handling.",
        ].join("\n"),
        "utf8",
      );

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(runtime, {
        input: "cjk.md",
        output: "project-output",
        keepCodexReport: true,
        profileCodexRunner: duplicateTitleProfileRunner(),
        identityUidFactory: () => "abc12345",
      });

      expect(stdout.text).toContain("Project signal mode: codex-assisted");
      expect(stdout.text).toContain("Profile decision mode: adapted");
      expect(stdout.text).toContain("Template decision mode: deterministic");

      const profileText = await readFile(join(outputPath, "profile.yml"), "utf8");
      const templateText = await readFile(join(outputPath, "template.html"), "utf8");
      expect(profileText).toContain("titleBlock:");
      expect(profileText).toContain("metadataTitle: auto");
      expect(templateText).not.toContain('<header class="document-title">');
      expect(templateText).toContain("$body$");

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        phases: {
          profile: { decisionMode: string; signalMode: string };
          template: { decisionMode: string; signalMode: string };
        };
      };
      expect(report.phases.profile).toMatchObject({
        decisionMode: "adapted",
        signalMode: "document-informed",
      });
      expect(report.phases.template).toMatchObject({
        decisionMode: "deterministic",
        signalMode: "deterministic",
      });
    });
  });

  test("renders a project bundle equivalently through bundle and explicit inputs", async () => {
    await withTempFixtureDir("md-pdf-project-codex-action-render-feed", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "project-output");
      const pdfPath = join(fixtureDir, "rendered.pdf");
      const htmlPath = join(fixtureDir, "rendered.html");
      const renderedStyles: string[] = [];
      let renderedTemplate = "";

      await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
      await writeFile(inputPath, "# Report\n\n```ts\nconst ok = true;\n```\n", "utf8");

      const { runtime: projectRuntime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });

      await actionMdPdfProjectCodex(projectRuntime, {
        baseProfile: "base.yml",
        output: "project-output",
        identityUidFactory: () => "abc12345",
      });

      const { calls, runner } = createPdfRunner({
        html: "<html><body><pre><code>const ok = true;</code></pre></body></html>",
      });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            renderedTemplate = await readFile(templatePath, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((arg, index) => (arg === "--stylesheet" ? index : -1))
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
      const {
        runtime: renderRuntime,
        stdout,
        expectNoStderr,
      } = createActionTestRuntime({
        cwd: fixtureDir,
      });

      await actionMdToPdf(renderRuntime, {
        input: "report.md",
        profile: "project-output/profile.yml",
        template: "project-output/template.html",
        css: "project-output/style.css",
        output: "rendered.pdf",
        htmlOutput: "rendered.html",
        runner: capturingRunner,
      });

      const weasyprintRender = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintRender?.args).toContain(join(outputPath, "style.css"));
      expect(await readFile(pdfPath, "utf8")).toContain("%PDF");
      expect(await readFile(htmlPath, "utf8")).toContain("<html>");
      expect(renderedTemplate).toContain("$body$");
      expect(renderedStyles.join("\n")).toContain(".cdx-code-line");
      expect(stdout.text).toContain("Wrote PDF: rendered.pdf");
      expectNoStderr();

      const bundlePdfPath = join(fixtureDir, "rendered-bundle.pdf");
      const bundleHtmlPath = join(fixtureDir, "rendered-bundle.html");
      const bundleStyles: string[] = [];
      let bundleTemplate = "";
      const { calls: bundleCalls, runner: bundleRunner } = createPdfRunner({
        html: "<html><body><pre><code>const ok = true;</code></pre></body></html>",
      });
      const bundleCapturingRunner: MarkdownPdfProcessRunner = async (
        command,
        args,
        runnerOptions,
      ) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            bundleTemplate = await readFile(templatePath, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((arg, index) => (arg === "--stylesheet" ? index : -1))
            .filter((index) => index >= 0);
          for (const index of stylesheetIndexes) {
            const stylesheetPath = args[index + 1];
            if (stylesheetPath) {
              bundleStyles.push(await readFile(stylesheetPath, "utf8"));
            }
          }
        }
        return bundleRunner(command, args, runnerOptions);
      };
      const {
        runtime: bundleRenderRuntime,
        stdout: bundleStdout,
        expectNoStderr: expectNoBundleStderr,
      } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdToPdf(bundleRenderRuntime, {
        input: "report.md",
        bundle: "project-output",
        output: "rendered-bundle.pdf",
        htmlOutput: "rendered-bundle.html",
        runner: bundleCapturingRunner,
      });

      const bundleWeasyprintRender = bundleCalls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(bundleWeasyprintRender?.args).toContain(join(outputPath, "style.css"));
      expect(await readFile(bundlePdfPath, "utf8")).toBe(await readFile(pdfPath, "utf8"));
      expect(await readFile(bundleHtmlPath, "utf8")).toBe(await readFile(htmlPath, "utf8"));
      expect(bundleTemplate).toBe(renderedTemplate);
      expect(bundleStyles).toEqual(renderedStyles);
      expect(bundleStdout.text).toContain("Resolved Markdown PDF bundle: project-output");
      expectNoBundleStderr();
    });
  });

  test("does not report forwarded profile directions as unsupported after template adaptation", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-action-forwarded-direction-handled",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "project-output");
        const reportPath = join(outputPath, "project.codex-report.json");
        const forwardedDirection = "cover image first";

        await writeFile(join(fixtureDir, "base.yml"), BASE_PROFILE, "utf8");
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");

        const { runtime, stdout } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });

        await actionMdPdfProjectCodex(runtime, {
          input: "report.md",
          baseProfile: "base.yml",
          intent: "cover layout",
          output: "project-output",
          keepCodexReport: true,
          profileCodexRunner: adaptedProfileRunner([forwardedDirection]),
          templateCodexRunner: stubTemplateRunner(adaptedTemplateResponse()),
          identityUidFactory: () => "abc12345",
        });

        expect(stdout.text).toContain("Final decision mode: adapted");
        expect(stdout.text).not.toContain(`Unsupported direction: ${forwardedDirection}`);

        const report = JSON.parse(await readFile(reportPath, "utf8")) as {
          unsupportedDirections: string[];
        };
        expect(report.unsupportedDirections).toEqual([]);
        expect(await pathExists(join(outputPath, "profile.yml"))).toBe(true);
        expect(await pathExists(join(outputPath, "template.html"))).toBe(true);
        expect(await pathExists(join(outputPath, "style.css"))).toBe(true);
      },
    );
  });
});
