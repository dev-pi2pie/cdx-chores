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
