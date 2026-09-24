import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../../../../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf";
import { MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER } from "../../../../src/cli/markdown-pdf/profile";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { createPdfRunner } from "./render-support";

const MANAGED_TEXT_COVER_TEMPLATE = `<!-- cdx-chores md pdf-template codex | bundle=test | family=document-layered -->
<html><body>
<section class="pdf-cover pdf-cover--report" ${MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER}></section>
<main class="document-body">$body$</main>
</body></html>
`;

describe("managed Project text-cover render", () => {
  test("resolves one saved Template against each render's effective metadata", async () => {
    await withTempFixtureDir("md-pdf-managed-text-cover-render", async (fixtureDir) => {
      const templatePath = join(fixtureDir, "template.html");
      const profilePath = join(fixtureDir, "profile.yml");
      const firstMarkdown = join(fixtureDir, "first.md");
      const secondMarkdown = join(fixtureDir, "second.md");
      await writeFile(templatePath, MANAGED_TEXT_COVER_TEMPLATE, "utf8");
      await writeFile(
        profilePath,
        [
          "cover:",
          "  enabled: true",
          "  style: report",
          "  fields:",
          '    title: "{title}"',
          '    subtitle: "{subtitle}"',
          "titleBlock:",
          "  metadataTitle: auto",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        firstMarkdown,
        ["---", "title: First Title", "subtitle: First Subtitle", "---", "# Body", ""].join("\n"),
        "utf8",
      );
      await writeFile(
        secondMarkdown,
        ["---", "title: Second Title", "subtitle: Second Subtitle", "---", "# Body", ""].join("\n"),
        "utf8",
      );

      const { runner } = createPdfRunner({ html: "<html><body>Body</body></html>" });
      const templates: string[] = [];
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, options) => {
        if (command === "pandoc" && !args.includes("--version")) {
          templates.push(await readFile(args[args.indexOf("--template") + 1]!, "utf8"));
        }
        return runner(command, args, options);
      };
      const { runtime } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(firstMarkdown),
        output: toRepoRelativePath(join(fixtureDir, "first.pdf")),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        runner: capturingRunner,
      });
      await writeFile(
        profilePath,
        (await readFile(profilePath, "utf8")).replace("style: report", "style: plain"),
        "utf8",
      );
      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(secondMarkdown),
        output: toRepoRelativePath(join(fixtureDir, "second.pdf")),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        meta: ["title=Override Title"],
        runner: capturingRunner,
      });

      expect(templates).toHaveLength(2);
      expect(templates[0]).toContain("First Title");
      expect(templates[0]).toContain("First Subtitle");
      expect(templates[0]).toContain('class="pdf-cover pdf-cover--report"');
      expect(templates[0]).not.toContain("Second Title");
      expect(templates[1]).toContain("Override Title");
      expect(templates[1]).toContain("Second Subtitle");
      expect(templates[1]).toContain('class="pdf-cover pdf-cover--plain"');
      expect(templates[1]).not.toContain("First Title");
      for (const template of templates) {
        expect(template.match(/<section class="pdf-cover\b/gu)).toHaveLength(1);
        expect(template).not.toContain(MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER);
      }
      expect(await readFile(templatePath, "utf8")).toBe(MANAGED_TEXT_COVER_TEMPLATE);
    });
  });

  test("fails before renderer probes when a marked Template loses its Profile cover", async () => {
    await withTempFixtureDir("md-pdf-managed-text-cover-disabled", async (fixtureDir) => {
      const templatePath = join(fixtureDir, "template.html");
      const profilePath = join(fixtureDir, "profile.yml");
      const inputPath = join(fixtureDir, "input.md");
      await writeFile(templatePath, MANAGED_TEXT_COVER_TEMPLATE, "utf8");
      await writeFile(profilePath, "cover:\n  enabled: false\n", "utf8");
      await writeFile(inputPath, "# Body\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Body</body></html>" });
      const { runtime } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "output.pdf")),
            profile: toRepoRelativePath(profilePath),
            template: toRepoRelativePath(templatePath),
            runner,
          }),
        {
          code: "MARKDOWN_PDF_COVER_BOUNDARY_REQUIRED",
          messageIncludes: "enabled Profile cover",
          exitCode: 2,
        },
      );
      expect(calls).toHaveLength(0);
    });
  });
});
