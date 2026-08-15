import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  bindMarkdownPdfDeterministicRecipeDestination,
  markdownPdfDeterministicOutputFiles,
  prepareMarkdownPdfDeterministicRecipe,
  writeBoundMarkdownPdfDeterministicRecipe,
} from "../../src/cli/interactive/markdown/deterministic-authoring";
import { renderDeterministicRecipeReview } from "../../src/cli/interactive/markdown/authoring-review";
import {
  collectMarkdownPdfProfileFormalGuideAnswers,
  compileMarkdownPdfFormalGuideOptions,
  reviseMarkdownPdfFormalGuidePageChrome,
  reviseMarkdownPdfFormalGuidePageNumbers,
  type MarkdownPdfFormalGuidePrompts,
  type MarkdownPdfProfileFormalGuideAnswers,
} from "../../src/cli/interactive/markdown/formal-guide";
import { collectMarkdownPdfProfileAuthoringCapabilityRequirements } from "../../src/cli/markdown-pdf/profile-authoring-review";
import {
  normalizeMarkdownPdfProfile,
  readMarkdownPdfProfileFile,
} from "../../src/cli/markdown-pdf/profile";
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
          pageNumbers: {
            enabled: true,
            scope: "body",
            countFrom: "body",
            start: 0,
            increment: 2,
            position: "top-right",
            format: "Page {page}",
          },
          pageChrome: {
            header: {
              left: "{company}",
              center: "",
              right: "{title}",
              style: { fontSize: "8pt", color: "#667085" },
            },
            footer: { left: "{author}", center: "", right: "{date}" },
          },
        },
      });

      if (candidate.artifact !== "profile") {
        throw new Error("Expected a prepared Profile candidate.");
      }
      expect(candidate.prepared.profile.code).toEqual(code);
      expect(candidate.prepared.profile.pageNumbers).toEqual({
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
        position: "top-right",
        format: "Page {page}",
      });
      expect(candidate.prepared.profile.header).toEqual({
        left: "{company}",
        center: "",
        right: "{title}",
        style: { fontSize: "8pt", color: "#667085" },
      });

      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output: "profile.yml",
      });
      await writeBoundMarkdownPdfDeterministicRecipe(bound);
      const written = await readFile(join(fixtureDir, "profile.yml"), "utf8");
      expect(written).toContain("highlight: true");
      expect(written).toContain("theme: light-plus");
      expect(written).toContain("lineNumbers: true");
      expect(written).toContain("transformerNotation: false");
      expect(written).toContain("countFrom: body");
      expect(written).toContain("start: 0");
      expect(written).toContain("increment: 2");
      expect(written).toContain("fontSize: 8pt");

      const persisted = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      const reloaded = normalizeMarkdownPdfProfile({ profile: persisted }).profile;
      expect(reloaded.pageNumbers).toEqual({
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
        position: "top-right",
        format: "Page {page}",
      });
      expect(reloaded.header).toEqual({
        left: "{company}",
        center: "",
        right: "{title}",
        style: { fontSize: "8pt", color: "#667085" },
      });
      expect(reloaded.footer).toEqual({ left: "{author}", center: "", right: "{date}" });
      expect(collectMarkdownPdfProfileAuthoringCapabilityRequirements(reloaded)).toEqual([
        {
          capabilityId: "pageNumbers.start",
          requestedBy: ["pageNumbers.start"],
          minimumVersion: "65.1",
        },
        {
          capabilityId: "pageNumbers.increment",
          requestedBy: ["pageNumbers.increment"],
          minimumVersion: "65.1",
        },
        {
          capabilityId: "pageNumbers.countFrom.body",
          requestedBy: ["pageNumbers.countFrom"],
          minimumVersion: "65.1",
        },
        {
          capabilityId: "pageChrome.fontSize",
          requestedBy: ["header.style.fontSize"],
          minimumVersion: "65.1",
        },
        {
          capabilityId: "pageChrome.color",
          requestedBy: ["header.style.color"],
          minimumVersion: "65.1",
        },
      ]);
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

  test.each([{ outcome: "body" as const }, { outcome: "document" as const }])(
    "saves and reloads the $outcome guided page-number outcome with fresh slot ownership",
    async ({ outcome }) => {
      await withTempFixtureDir(`md-pdf-interactive-guided-${outcome}`, async (fixtureDir) => {
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        const answers = await collectMarkdownPdfProfileFormalGuideAnswers({
          layout: () => ({
            preset: "article",
            pageSize: "A4",
            orientation: { mode: "preset-default" },
          }),
          margins: () => ({ mode: "preset-default" }),
          tocEnabled: () => false,
          tocDetails: () => {
            throw new Error("ToC details must not be prompted");
          },
          codeHighlight: () => false,
          codeTheme: () => {
            throw new Error("Code theme must not be prompted");
          },
          codeLineNumbers: () => {
            throw new Error("Code line numbers must not be prompted");
          },
          codeTransformerNotation: () => {
            throw new Error("Transformer notation must not be prompted");
          },
          pageNumbersEnabled: () => true,
          pageNumberOutcome: () => outcome,
          pageNumberLabel: ({ current }) => {
            expect(current).toBeUndefined();
            return outcome === "body" ? "Page {page}" : "{company} — PDF {pdfPage} of {pdfPages}";
          },
          pageNumberPosition: () => "top-right",
          repeatingContentEnabled: ({ current }) => {
            expect(current).toBeUndefined();
            return true;
          },
          repeatingContentPositions: ({ available, current, reserved }) => {
            expect(current).toBeUndefined();
            expect(reserved).toBe("top-right");
            expect(available).not.toContain("top-right");
            return ["top-left", "top-center"];
          },
          repeatingContent: ({ current, position }) => {
            expect(current).toBeUndefined();
            return position === "top-left" ? "Report" : "{title}";
          },
          clearOccupiedPageNumberPosition: () => {
            throw new Error("Fresh page-number position must not require conflict clearing");
          },
        });
        const candidate = prepareMarkdownPdfDeterministicRecipe({
          artifact: "profile",
          preparation: "formal-guide",
          formalGuideAnswers: answers,
          options: compileMarkdownPdfFormalGuideOptions(answers),
        });
        const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
          output: `${outcome}.yml`,
        });

        await writeBoundMarkdownPdfDeterministicRecipe(bound);

        const persisted = await readMarkdownPdfProfileFile(join(fixtureDir, `${outcome}.yml`));
        const reloaded = normalizeMarkdownPdfProfile({ profile: persisted }).profile;
        const expectedPageNumbers = {
          enabled: true,
          scope: outcome,
          countFrom: outcome,
          start: 1,
          increment: 1,
          position: "top-right",
          format: outcome === "body" ? "Page {page}" : "{company} — PDF {pdfPage} of {pdfPages}",
        } as const;
        const expectedHeader = {
          left: "Report",
          center: "{title}",
          right: "",
        };
        expect(persisted.pageNumbers).toEqual(expectedPageNumbers);
        expect(persisted.header).toEqual(expectedHeader);
        expect(reloaded.pageNumbers).toEqual(expectedPageNumbers);
        expect(reloaded.header).toEqual(expectedHeader);
        expect(reloaded.footer).toEqual({ left: "", center: "", right: "" });
      });
    },
  );

  test("reviews, writes, and reloads disabled page numbers with literal start zero", async () => {
    await withTempFixtureDir("md-pdf-interactive-disabled-page-numbers", async (fixtureDir) => {
      const { runtime, stderr } = createActionTestRuntime({ cwd: fixtureDir });
      const candidate = prepareMarkdownPdfDeterministicRecipe({
        artifact: "profile",
        preparation: "formal-guide",
        formalGuideAnswers: {
          layout: {
            preset: "article",
            pageSize: "A4",
            orientation: { mode: "preset-default" },
          },
          margins: { mode: "preset-default" },
          toc: { enabled: false },
          code: {
            highlight: false,
            theme: "github-light",
            lineNumbers: false,
            transformerNotation: false,
          },
          pageNumbers: {
            enabled: false,
            scope: "body",
            countFrom: "document",
            start: 0,
            increment: 1,
            position: "bottom-center",
            format: "{page}",
          },
          pageChrome: {
            header: { left: "", center: "", right: "" },
            footer: { left: "", center: "", right: "" },
          },
        },
      });

      renderDeterministicRecipeReview(runtime, candidate);
      expect(stderr.text).toContain("Reusable Profile page numbering:");
      expect(stderr.text).toContain("- Enabled: no");
      expect(stderr.text).not.toContain("- Start: 0");

      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output: "disabled.yml",
      });
      await writeBoundMarkdownPdfDeterministicRecipe(bound);
      const persisted = await readMarkdownPdfProfileFile(join(fixtureDir, "disabled.yml"));
      const reloaded = normalizeMarkdownPdfProfile({ profile: persisted }).profile;
      expect(reloaded.pageNumbers.enabled).toBe(false);
      expect(reloaded.pageNumbers.start).toBe(0);
    });
  });

  test("offers all repeating-content positions when page numbering is disabled and reloads them", async () => {
    await withTempFixtureDir(
      "md-pdf-interactive-disabled-repeating-content",
      async (fixtureDir) => {
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        const answers = await collectMarkdownPdfProfileFormalGuideAnswers({
          layout: () => ({
            preset: "article",
            pageSize: "A4",
            orientation: { mode: "preset-default" },
          }),
          margins: () => ({ mode: "preset-default" }),
          tocEnabled: () => false,
          tocDetails: () => {
            throw new Error("ToC details must not be prompted");
          },
          codeHighlight: () => false,
          codeTheme: () => {
            throw new Error("Code theme must not be prompted");
          },
          codeLineNumbers: () => {
            throw new Error("Code line numbers must not be prompted");
          },
          codeTransformerNotation: () => {
            throw new Error("Transformer notation must not be prompted");
          },
          pageNumbersEnabled: () => false,
          pageNumberOutcome: () => {
            throw new Error("Page-number outcome must not be prompted");
          },
          pageNumberLabel: () => {
            throw new Error("Page-number label must not be prompted");
          },
          pageNumberPosition: () => {
            throw new Error("Page-number position must not be prompted");
          },
          repeatingContentEnabled: () => true,
          repeatingContentPositions: ({ available, reserved }) => {
            expect(available).toEqual([
              "top-left",
              "top-center",
              "top-right",
              "bottom-left",
              "bottom-center",
              "bottom-right",
            ]);
            expect(reserved).toBeUndefined();
            return ["top-left", "bottom-center"];
          },
          repeatingContent: ({ position }) =>
            position === "top-left" ? "{company}" : "Page-free footer",
          clearOccupiedPageNumberPosition: () => {
            throw new Error("Disabled page numbering must not require conflict clearing");
          },
        });
        const candidate = prepareMarkdownPdfDeterministicRecipe({
          artifact: "profile",
          preparation: "formal-guide",
          formalGuideAnswers: answers,
          options: compileMarkdownPdfFormalGuideOptions(answers),
        });
        const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
          output: "disabled-repeating-content.yml",
        });

        await writeBoundMarkdownPdfDeterministicRecipe(bound);

        const persisted = await readMarkdownPdfProfileFile(
          join(fixtureDir, "disabled-repeating-content.yml"),
        );
        const reloaded = normalizeMarkdownPdfProfile({ profile: persisted }).profile;
        expect(reloaded.pageNumbers.enabled).toBe(false);
        expect(reloaded.header.left).toBe("{company}");
        expect(reloaded.footer.center).toBe("Page-free footer");
      },
    );
  });

  test("revises page numbers and chrome before exact bind, write, and reload", async () => {
    await withTempFixtureDir("md-pdf-interactive-revised-page-policy", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const initial: MarkdownPdfProfileFormalGuideAnswers = {
        layout: {
          preset: "article",
          pageSize: "A4",
          orientation: { mode: "preset-default" },
        },
        margins: { mode: "preset-default" },
        toc: { enabled: true, depth: 4, pageBreak: "after" },
        code: {
          highlight: true,
          theme: "light-plus",
          lineNumbers: true,
          transformerNotation: false,
        },
        pageNumbers: {
          enabled: false,
          scope: "body",
          countFrom: "document",
          start: 0,
          increment: 1,
          position: "bottom-center",
          format: "{page}",
        },
        pageChrome: {
          header: { left: "Old", center: "", right: "" },
          footer: { left: "", center: "", right: "Old" },
        },
      };
      const revisedNumbers = await reviseMarkdownPdfFormalGuidePageNumbers(initial, {
        pageNumbersEnabled: () => true,
        pageNumberOutcome: () => "body",
        pageNumberLabel: ({
          current,
        }: Parameters<MarkdownPdfFormalGuidePrompts["pageNumberLabel"]>[0]) => {
          expect(current).toBe("{page}");
          return "Page {page}";
        },
        pageNumberPosition: () => "top-right",
      } as unknown as MarkdownPdfFormalGuidePrompts);
      const revised = await reviseMarkdownPdfFormalGuidePageChrome(revisedNumbers, {
        repeatingContentEnabled: () => true,
        repeatingContentPositions: ({
          available,
          reserved,
        }: Parameters<MarkdownPdfFormalGuidePrompts["repeatingContentPositions"]>[0]) => {
          expect(available).not.toContain("top-right");
          expect(reserved).toBe("top-right");
          return ["top-left", "bottom-left", "bottom-right"];
        },
        repeatingContent: ({
          current,
          position,
        }: Parameters<MarkdownPdfFormalGuidePrompts["repeatingContent"]>[0]) => {
          expect(current).toBe(position === "bottom-left" ? undefined : "Old");
          if (position === "top-left") {
            return "{company}";
          }
          return position === "bottom-left" ? "{author}" : "{date}";
        },
        clearOccupiedPageNumberPosition: () => {
          throw new Error("The revised page-number position is not occupied");
        },
      } as unknown as MarkdownPdfFormalGuidePrompts);
      const candidate = prepareMarkdownPdfDeterministicRecipe({
        artifact: "profile",
        preparation: "formal-guide",
        formalGuideAnswers: revised,
        options: compileMarkdownPdfFormalGuideOptions(revised),
      });
      const bound = await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, {
        output: "revised.yml",
      });
      await writeBoundMarkdownPdfDeterministicRecipe(bound);
      const persisted = await readMarkdownPdfProfileFile(join(fixtureDir, "revised.yml"));
      const normalized = normalizeMarkdownPdfProfile({ profile: persisted }).profile;

      expect(normalized.pageNumbers).toEqual(revised.pageNumbers);
      expect(normalized.header).toEqual(revised.pageChrome.header);
      expect(normalized.footer).toEqual(revised.pageChrome.footer);
      expect(normalized.code).toEqual(revised.code);
      expect(persisted.toc).toEqual({ enabled: true, depth: 4, pageBreak: "after" });
    });
  });
});
