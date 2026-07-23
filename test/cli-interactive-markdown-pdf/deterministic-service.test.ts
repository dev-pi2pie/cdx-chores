import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  bindMarkdownPdfDeterministicRecipeDestination,
  markdownPdfDeterministicOutputFiles,
  prepareMarkdownPdfDeterministicRecipe,
  writeBoundMarkdownPdfDeterministicRecipe,
} from "../../src/cli/interactive/markdown/deterministic-authoring";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

describe("interactive Markdown PDF deterministic service", () => {
  test("prepares and writes the exact accepted Profile through an explicit destination", async () => {
    await withTempFixtureDir("md-pdf-interactive-profile", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const candidate = prepareMarkdownPdfDeterministicRecipe({
        artifact: "profile",
        preparation: "starter",
        options: { preset: "wide-table", toc: true },
      });

      expect(candidate.artifact).toBe("profile");
      if (candidate.artifact !== "profile") {
        throw new Error("Expected a prepared Profile candidate.");
      }
      const acceptedProfile = structuredClone(candidate.prepared.profile);
      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output: "profile.json",
      });
      expect(candidate.prepared.profile).toEqual(acceptedProfile);
      expect(markdownPdfDeterministicOutputFiles(bound)).toEqual([
        join(fixtureDir, "profile.json"),
      ]);

      await writeBoundMarkdownPdfDeterministicRecipe(bound);

      const written = JSON.parse(await readFile(join(fixtureDir, "profile.json"), "utf8"));
      expect(written).toEqual(acceptedProfile);
    });
  });

  test("serializes accepted formal-guide code settings only into a Profile", async () => {
    await withTempFixtureDir("md-pdf-interactive-profile-code", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const code = {
        highlight: true,
        theme: "light-plus" as const,
        lineNumbers: true,
        transformerNotation: false,
      };
      const candidate = prepareMarkdownPdfDeterministicRecipe({
        artifact: "profile",
        preparation: "formal-guide",
        formalGuideAnswers: {
          code,
          layout: {
            preset: "article",
            pageSize: "A4",
            orientation: { mode: "preset-default" },
          },
          margins: { mode: "preset-default" },
          toc: { enabled: false },
        },
      });

      if (candidate.artifact !== "profile") {
        throw new Error("Expected a prepared Profile candidate.");
      }
      expect(candidate.prepared.profile.code).toEqual(code);

      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output: "profile.yml",
      });
      await writeBoundMarkdownPdfDeterministicRecipe(bound);
      const written = await readFile(join(fixtureDir, "profile.yml"), "utf8");
      expect(written).toContain("highlight: true");
      expect(written).toContain("theme: light-plus");
      expect(written).toContain("lineNumbers: true");
      expect(written).toContain("transformerNotation: false");
    });
  });

  test("prepares and writes both accepted Template bundle files", async () => {
    await withTempFixtureDir("md-pdf-interactive-template", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const candidate = prepareMarkdownPdfDeterministicRecipe({
        artifact: "template-bundle",
        preparation: "formal-guide",
        options: { margin: "14mm", pageSize: "Letter" },
      });

      expect(candidate.artifact).toBe("template-bundle");
      if (candidate.artifact !== "template-bundle") {
        throw new Error("Expected a prepared Template candidate.");
      }
      const acceptedTemplate = candidate.prepared.templateHtml;
      const acceptedStyle = candidate.prepared.styleCss;
      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output: "template",
      });

      await writeBoundMarkdownPdfDeterministicRecipe(bound);

      expect(await readFile(join(fixtureDir, "template", "template.html"), "utf8")).toBe(
        acceptedTemplate,
      );
      expect(await readFile(join(fixtureDir, "template", "style.css"), "utf8")).toBe(acceptedStyle);
    });
  });
});
