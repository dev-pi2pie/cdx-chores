import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfProjectCodex } from "../../../../src/cli/markdown-pdf/project-codex";
import { readMarkdownPdfProfileFile } from "../../../../src/cli/markdown-pdf/profile";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { mockPng } from "../page-number-support";

describe("Markdown PDF Project image-cover known case", () => {
  test("keeps the saved report style while choosing a media cover without the report bar", async () => {
    await withTempFixtureDir("md-pdf-project-image-report-cover", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        "cover:\n  enabled: true\n  style: report\n",
        "utf8",
      );
      await writeFile(join(fixtureDir, "cover.png"), mockPng());

      const { runtime, stdout } = createActionTestRuntime({ cwd: fixtureDir });
      const forbidCodex = async () => {
        throw new Error("Deterministic Project must not request Codex");
      };
      await actionMdPdfProjectCodex(runtime, {
        baseProfile: "base.yml",
        coverImage: "cover.png",
        output: "project",
        identityUidFactory: () => "abc12345",
        profileCodexRunner: forbidCodex,
        templateCodexRunner: forbidCodex,
      });

      const saved = await readMarkdownPdfProfileFile(join(fixtureDir, "project", "profile.yml"));
      const template = await readFile(join(fixtureDir, "project", "template.html"), "utf8");
      const css = await readFile(join(fixtureDir, "project", "style.css"), "utf8");

      expect(stdout.text).toContain("Project signal mode: deterministic");
      expect(saved.cover).toMatchObject({ enabled: true, style: "report" });
      expect(template).toContain("family=cover-media-layered");
      expect(template).toContain('<section class="pdf-cover pdf-cover--media"');
      expect(template).toContain('class="pdf-cover-media"');
      expect(template).not.toContain("pdf-cover--report");
      expect(template).not.toContain("pdf-cover__content");
      expect(css).not.toContain("border-left: 8mm solid #1f5f8b");
    });
  });
});
