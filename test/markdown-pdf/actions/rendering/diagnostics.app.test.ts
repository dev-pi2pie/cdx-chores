import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf, prepareMarkdownPdfRender } from "../../../../src/cli/actions";
import { resolveCliColorEnabled } from "../../../../src/cli/colors";
import {
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_EMPTY_COVER_WARNING,
} from "../../../../src/cli/markdown-pdf";

import { createPdfRunner } from "./render-support";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";

describe("Markdown PDF structured diagnostics", () => {
  test("evaluates cover visibility after Profile, frontmatter, and CLI metadata precedence", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-cover-metadata", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const originalProfile = [
        "metadata:",
        "  coverLabel: Profile label",
        "cover:",
        "  enabled: true",
        "  fields:",
        '    title: "{coverLabel}"',
        '    subtitle: ""',
        '    author: ""',
        '    company: ""',
        '    date: ""',
        "",
      ].join("\n");
      await writeFile(inputPath, "---\ncoverLabel: Frontmatter label\n---\n# Report\n", "utf8");
      await writeFile(profilePath, originalProfile, "utf8");
      const { runtime } = createActionTestRuntime();

      const visible = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
      });
      expect(visible.normalizedProfile.metadata.coverLabel).toBe("Frontmatter label");
      expect(
        visible.diagnostics.conditions.some(
          ({ conditionId }) =>
            conditionId === MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverFieldsEmpty,
        ),
      ).toBeFalse();

      const empty = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        meta: ["coverLabel=   "],
      });
      expect(empty.normalizedProfile.metadata.coverLabel).toBe("   ");
      expect(empty.diagnostics.conditions).toContainEqual(
        expect.objectContaining({
          conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.coverFieldsEmpty,
          context: { kind: "empty-cover-fields" },
        }),
      );
      expect(await readFile(profilePath, "utf8")).toBe(originalProfile);
      expect(JSON.stringify(empty.diagnostics)).not.toContain("\u001b");
    });
  });

  test("prints one empty-cover warning and continues rendering without rewriting the Profile", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-empty-cover-render", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      const originalProfile = "cover:\n  enabled: true\n";
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, originalProfile, "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(stderr.text.match(new RegExp(MARKDOWN_PDF_EMPTY_COVER_WARNING, "g"))).toHaveLength(1);
      expect(stderr.text).not.toContain("\u001b");
      expect(await readFile(profilePath, "utf8")).toBe(originalProfile);
    });
  });

  test("uses the direct effective disable during preparation", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-effective-disable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "schemaVersion: 2",
          "footer:",
          "  center: Existing footer",
          "pageNumbers:",
          "  enabled: true",
          '  format: "{pages}"',
          "",
        ].join("\n"),
        "utf8",
      );
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        pageNumbers: false,
      });

      expect(prepared.normalizedProfile.pageNumbers.enabled).toBeTrue();
      expect(prepared.pageNumberConfiguration.effective.enabled).toBeFalse();
      expect(prepared.diagnostics).toEqual({ conditions: [] });
    });
  });

  test("uses the direct effective enable for a declared legacy Profile", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-effective-enable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const originalProfile = [
        "schemaVersion: 2",
        "pageNumbers:",
        "  enabled: false",
        '  format: "{pages}"',
        "",
      ].join("\n");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, originalProfile, "utf8");
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        pageNumbers: true,
      });

      expect(prepared.pageNumberConfiguration.effective.enabled).toBeTrue();
      expect(prepared.diagnostics.conditions).toContainEqual(
        expect.objectContaining({
          conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyPagesTokenMigration,
          context: {
            kind: "legacy-pages-token-migration",
            countFrom: "document",
            declaredRevision: 2,
          },
        }),
      );
      expect(await readFile(profilePath, "utf8")).toBe(originalProfile);
    });
  });

  test("preserves the declared legacy revision when the Profile comes from a bundle", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-bundle-source", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const originalProfile = [
        "schemaVersion: 1",
        "pageNumbers:",
        "  enabled: true",
        "  countFrom: body",
        '  format: "Page {page} of {pages}"',
        "",
      ].join("\n");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, originalProfile, "utf8");
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        bundle: toRepoRelativePath(fixtureDir),
      });

      expect(prepared.resolvedBundle?.profile?.source).toBe("bundle");
      expect(prepared.diagnostics.conditions).toContainEqual(
        expect.objectContaining({
          conditionId: MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.legacyPagesTokenMigration,
          context: {
            kind: "legacy-pages-token-migration",
            countFrom: "body",
            declaredRevision: 1,
          },
        }),
      );
      expect(await readFile(profilePath, "utf8")).toBe(originalProfile);
    });
  });

  test("prints each structured warning once while preserving successful rendering", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "schemaVersion: 2",
          "footer:",
          "  center: Existing footer",
          "pageNumbers:",
          "  enabled: true",
          '  format: "Page {page} of {pages}"',
          "  increment: 2",
          "",
        ].join("\n"),
        "utf8",
      );
      const { runner } = createPdfRunner({
        html: '<html><body><div class="document-body">Report</div></body></html>',
      });
      const { runtime, stdout, stderr } = createActionTestRuntime();
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        runner,
      });

      expect(stdout.text).toContain("Wrote PDF:");
      expect(stderr.text).toStartWith(
        "\u001b[1m\u001b[33mMarkdown PDF render warnings:\u001b[39m\u001b[22m\n",
      );
      expect(stderr.text.match(/replace configured footer\.center content/g)).toHaveLength(1);
      expect(stderr.text.match(/replace \{pages\} with \{pdfPages\}/g)).toHaveLength(1);
    });
  });

  test("keeps action warning output plain for no-color and redirected stderr", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-action-plain", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "schemaVersion: 2",
          "pageNumbers:",
          "  enabled: true",
          '  format: "Page {page} of {pages}"',
          "",
        ].join("\n"),
        "utf8",
      );

      const cases = [
        {
          colorEnabled: false,
          label: "--no-color/runtime color disabled",
          stderrTty: true,
          stdoutTty: true,
        },
        {
          colorEnabled: resolveCliColorEnabled({ env: { NO_COLOR: "1" } }),
          label: "NO_COLOR",
          stderrTty: true,
          stdoutTty: true,
        },
        {
          colorEnabled: true,
          label: "redirected stderr",
          stderrTty: false,
          stdoutTty: true,
        },
      ] as const;

      for (const [index, testCase] of cases.entries()) {
        const { runner } = createPdfRunner({
          html: '<html><body><div class="document-body">Report</div></body></html>',
        });
        const { runtime, stderr } = createActionTestRuntime({
          colorEnabled: testCase.colorEnabled,
        });
        (runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = testCase.stdoutTty;
        (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = testCase.stderrTty;

        await actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(join(fixtureDir, `plain-${index}.pdf`)),
          profile: toRepoRelativePath(profilePath),
          runner,
        });

        expect(stderr.text, testCase.label).toStartWith("Markdown PDF render warnings:\n");
        expect(stderr.text, testCase.label).not.toContain("\u001b");
        expect(
          stderr.text.match(/MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION/g),
          testCase.label,
        ).toBeNull();
        expect(
          stderr.text.match(/replace \{pages\} with \{pdfPages\}/g),
          testCase.label,
        ).toHaveLength(1);
      }
    });
  });

  test("resets structured diagnostics between sequential renders", async () => {
    await withTempFixtureDir("md-pdf-diagnostics-sequential", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "first.md");
      const secondInputPath = join(fixtureDir, "second.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(firstInputPath, "# First\n", "utf8");
      await writeFile(secondInputPath, "# Second\n", "utf8");
      await writeFile(
        profilePath,
        ["footer:", "  center: Existing footer", "pageNumbers:", "  enabled: true", ""].join("\n"),
        "utf8",
      );
      const { runner } = createPdfRunner({
        html: '<html><body><div class="document-body">Report</div></body></html>',
      });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(firstInputPath),
        profile: toRepoRelativePath(profilePath),
        output: toRepoRelativePath(join(fixtureDir, "first.pdf")),
        runner,
      });
      const firstRenderStderr = stderr.text;
      expect(firstRenderStderr.match(/replace configured footer\.center content/g)).toHaveLength(1);

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(secondInputPath),
        output: toRepoRelativePath(join(fixtureDir, "second.pdf")),
        runner,
      });

      expect(stderr.text).toBe(firstRenderStderr);
    });
  });
});
