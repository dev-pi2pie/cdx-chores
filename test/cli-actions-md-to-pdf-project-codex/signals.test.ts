import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  collectMdPdfProjectCodexSignals,
  normalizeMdPdfProjectCodexCommandState,
  type MarkdownPdfProjectCodexProfilePhaseSignalMode,
  type MarkdownPdfProjectCodexSignalMode,
  type MarkdownPdfProjectCodexTemplatePhaseSignalMode,
  type MdPdfProjectCodexOptions,
} from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng } from "../cli-actions-md-to-pdf-template-codex/fixtures";

interface ExpectedModes {
  profileSignalMode: MarkdownPdfProjectCodexProfilePhaseSignalMode;
  signalMode: MarkdownPdfProjectCodexSignalMode;
  templateSignalMode: MarkdownPdfProjectCodexTemplatePhaseSignalMode;
}

async function collectModes(
  fixtureDir: string,
  options: MdPdfProjectCodexOptions,
): Promise<ExpectedModes> {
  const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, options);
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  return {
    profileSignalMode: signals.modes.profile,
    signalMode: signals.modes.project,
    templateSignalMode: signals.modes.template,
  };
}

describe("cli action modules: md pdf-project codex signal classification", () => {
  test("rejects invalid base profiles while collecting pre-Codex project signals", async () => {
    await withTempFixtureDir("md-pdf-project-codex-invalid-base-signals", async (fixtureDir) => {
      const invalidBases = [
        {
          contents: "pageNumbers: [\n",
          messageIncludes: "Failed to parse Markdown PDF profile YAML",
          name: "malformed.yml",
        },
        {
          contents: "unknown:\n  bad: true\n",
          messageIncludes: "Unknown Markdown PDF profile key",
          name: "unknown.yml",
        },
        {
          contents: "pageNumbers:\n  start: -1\n  increment: 0\n",
          messageIncludes: "start must be a non-negative integer",
          name: "invalid-arithmetic.yml",
        },
        {
          contents: "pageNumbers:\n  scope: document\n  countFrom: body\n",
          messageIncludes: "scope document cannot be used with countFrom body",
          name: "invalid-origin.yml",
        },
      ];
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      for (const invalidBase of invalidBases) {
        await writeFile(join(fixtureDir, invalidBase.name), invalidBase.contents, "utf8");
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          baseProfile: invalidBase.name,
          intent: "repair this profile",
        });
        await expectCliError(() => collectMdPdfProjectCodexSignals(runtime, state), {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: invalidBase.messageIncludes,
        });
      }
    });
  });

  test("classifies the project signal ladder while preserving phase-native modes", async () => {
    await withTempFixtureDir("md-pdf-project-codex-signals", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPlain body.\n", "utf8");
      await writeFile(
        join(fixtureDir, "wide-table.md"),
        [
          "# Report",
          "",
          "| c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 |",
          "| -- | -- | -- | -- | -- | -- | -- | -- |",
          "| a | b | c | d | e | f | g | h |",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(join(fixtureDir, "base.yml"), "page:\n  size: Letter\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));

      const cases: Array<{
        expected: ExpectedModes;
        name: string;
        options: MdPdfProjectCodexOptions;
      }> = [
        {
          name: "no signal",
          options: {},
          expected: {
            signalMode: "too-low-signal",
            profileSignalMode: "basic-default",
            templateSignalMode: "deterministic",
          },
        },
        {
          name: "base profile only",
          options: { baseProfile: "base.yml" },
          expected: {
            signalMode: "deterministic",
            profileSignalMode: "base-only-deterministic",
            templateSignalMode: "base-profile-only",
          },
        },
        {
          name: "cover image only",
          options: { coverImage: "cover.png" },
          expected: {
            signalMode: "deterministic",
            profileSignalMode: "basic-default",
            templateSignalMode: "cover-image-only",
          },
        },
        {
          name: "base profile plus cover image",
          options: { baseProfile: "base.yml", coverImage: "cover.png" },
          expected: {
            signalMode: "deterministic",
            profileSignalMode: "base-only-deterministic",
            templateSignalMode: "deterministic",
          },
        },
        {
          name: "plain markdown input",
          options: { input: "report.md" },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "document-informed",
            templateSignalMode: "deterministic",
          },
        },
        {
          name: "intent only",
          options: { intent: "client report" },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "hint-only",
            templateSignalMode: "deterministic",
          },
        },
        {
          name: "font hint only",
          options: { fontHint: ["prefer Noto Serif CJK TC"] },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "hint-only",
            templateSignalMode: "deterministic",
          },
        },
        {
          name: "base profile plus markdown input",
          options: { baseProfile: "base.yml", input: "report.md" },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "mixed-with-base",
            templateSignalMode: "base-profile-only",
          },
        },
        {
          name: "base profile plus intent",
          options: { baseProfile: "base.yml", intent: "client report" },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "mixed-with-base",
            templateSignalMode: "base-profile-only",
          },
        },
        {
          name: "base profile plus font hint",
          options: { baseProfile: "base.yml", fontHint: ["prefer Noto Sans"] },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "mixed-with-base",
            templateSignalMode: "base-profile-only",
          },
        },
        {
          name: "cover image plus plain markdown input",
          options: { coverImage: "cover.png", input: "report.md" },
          expected: {
            signalMode: "codex-assisted",
            profileSignalMode: "document-informed",
            templateSignalMode: "cover-image-only",
          },
        },
      ];

      for (const { expected, name, options } of cases) {
        expect(await collectModes(fixtureDir, options), name).toEqual(expected);
      }

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const defaultState = await normalizeMdPdfProjectCodexCommandState(runtime, {});
      const defaultSignals = await collectMdPdfProjectCodexSignals(runtime, defaultState);
      expect(defaultSignals.profile.baseProfile.available).toBe(false);
      expect(defaultSignals.profile.baseProfile.candidate).toBeUndefined();
      expect(defaultSignals.profile.basis.source).toBe("default-profile");
      expect(defaultSignals.shared.title.baseProfileMetadataTitle).toBeUndefined();
    });
  });

  test("marks template-owned document and intent signals for template Codex", async () => {
    await withTempFixtureDir("md-pdf-project-codex-template-owned-signals", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "wide-table.md"),
        [
          "# Report",
          "",
          "| c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 |",
          "| -- | -- | -- | -- | -- | -- | -- | -- |",
          "| a | b | c | d | e | f | g | h |",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const wideTableState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "wide-table.md",
      });
      const wideTableSignals = await collectMdPdfProjectCodexSignals(runtime, wideTableState);

      expect(wideTableSignals.modes.project).toBe("codex-assisted");
      expect(wideTableSignals.modes.profile).toBe("document-informed");
      expect(wideTableSignals.modes.template).toBe("codex-assisted");
      expect(wideTableSignals.shared.recipe.layoutPolicy.tableLayoutSignal.level).toBe("strong");
      expect(wideTableSignals.shared.recipe.layoutPolicy.tableLayoutSignal.signalLadder).toEqual([
        "overflowRows",
        "maxLineWidth",
        "maxColumns",
        "scannedRows",
      ]);
      expect(wideTableSignals.shared.recipe.layoutPolicy.tableLayoutSignal.reasons).toContain(
        "table rows have many columns",
      );
      expect(wideTableSignals.template.ownedSignals.requiresCodex).toBe(true);
      expect(wideTableSignals.template.ownedSignals.documentDirections).toEqual([
        "wide-table-document-signal",
        "custom table column widths",
        "arbitrary table CSS",
        "rotated individual pages",
        "exact table beautification",
      ]);

      const intentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "custom cover composition with brand styling",
      });
      const intentSignals = await collectMdPdfProjectCodexSignals(runtime, intentState);

      expect(intentSignals.modes.project).toBe("codex-assisted");
      expect(intentSignals.modes.profile).toBe("hint-only");
      expect(intentSignals.modes.template).toBe("codex-assisted");
      expect(intentSignals.template.ownedSignals.requiresCodex).toBe(true);
      expect(intentSignals.template.ownedSignals.intentDirections).toEqual([
        "cover-composition-intent",
        "brand-styling-intent",
      ]);

      const htmlTableIntentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "custom HTML and CSS for tables",
      });
      const htmlTableIntentSignals = await collectMdPdfProjectCodexSignals(
        runtime,
        htmlTableIntentState,
      );

      expect(htmlTableIntentSignals.modes.template).toBe("codex-assisted");
      expect(htmlTableIntentSignals.template.ownedSignals.requiresCodex).toBe(true);
      expect(htmlTableIntentSignals.template.ownedSignals.intentDirections).toEqual([
        "custom-html-css-intent",
        "table-layout-intent",
      ]);

      const nonTemplateIntentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "client report",
      });
      const nonTemplateIntentSignals = await collectMdPdfProjectCodexSignals(
        runtime,
        nonTemplateIntentState,
      );

      expect(nonTemplateIntentSignals.modes.profile).toBe("hint-only");
      expect(nonTemplateIntentSignals.modes.template).toBe("deterministic");
      expect(nonTemplateIntentSignals.template.ownedSignals.requiresCodex).toBe(false);
      expect(nonTemplateIntentSignals.template.ownedSignals.intentDirections).toEqual([]);
    });
  });
});
