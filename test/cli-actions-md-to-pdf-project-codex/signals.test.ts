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
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
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
    profileSignalMode: signals.profileSignalMode,
    signalMode: signals.signalMode,
    templateSignalMode: signals.templateSignalMode,
  };
}

describe("cli action modules: md pdf-project codex signal classification", () => {
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

      expect(wideTableSignals.signalMode).toBe("codex-assisted");
      expect(wideTableSignals.profileSignalMode).toBe("document-informed");
      expect(wideTableSignals.templateSignalMode).toBe("codex-assisted");
      expect(wideTableSignals.templateOwnedSignals.documentDirections).toContain(
        "wide-table-document-signal",
      );

      const intentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "custom cover composition with brand styling",
      });
      const intentSignals = await collectMdPdfProjectCodexSignals(runtime, intentState);

      expect(intentSignals.signalMode).toBe("codex-assisted");
      expect(intentSignals.profileSignalMode).toBe("hint-only");
      expect(intentSignals.templateSignalMode).toBe("codex-assisted");
      expect(intentSignals.templateOwnedSignals.intentDirections).toEqual([
        "cover-composition-intent",
        "brand-styling-intent",
      ]);
    });
  });
});
