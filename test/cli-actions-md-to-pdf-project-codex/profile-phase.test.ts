import { join } from "node:path";
import { writeFile } from "node:fs/promises";

import { describe, expect, test } from "bun:test";

import {
  collectMdPdfProjectCodexSignals,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  type MdPdfProjectCodexOptions,
} from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng, pathExists } from "../cli-actions-md-to-pdf-template-codex/fixtures";

function adaptedProfileRunner(candidateId = "wide-table", unmatchedDirections: string[] = []) {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
      ],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: ["profile warning"],
      fallback_reason: "",
      unmatched_directions: unmatchedDirections,
    });
}

function noUsableProfileRunner() {
  return async () =>
    JSON.stringify({
      decision_mode: "no-usable-profile",
      selected_candidate_id: "none",
      accepted_patches: [],
      accepted_font_patches: [],
      reasoning: "The requested profile directions are not representable.",
      warnings: ["unsupported profile direction"],
      fallback_reason: "No usable profile.",
      unmatched_directions: ["unsupported custom CSS"],
    });
}

async function runProfilePhaseFixture(fixtureDir: string, options: MdPdfProjectCodexOptions) {
  const { runtime, stderr } = createActionTestRuntime({
    cwd: fixtureDir,
    now: () => new Date("2026-07-04T08:00:00.000Z"),
  });
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, options);
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  const outputPlan = await planMdPdfProjectCodexOutput({
    identityUidFactory: () => "abc12345",
    runtime,
    signalMode: signals.modes.project,
    state,
  });
  const result = await runMdPdfProjectCodexProfilePhase({
    outputPlan,
    profileCodexRunner: options.profileCodexRunner,
    runtime,
    signals,
    state,
  });
  return { outputPlan, result, stderr };
}

describe("cli action modules: md pdf-project codex profile phase", () => {
  test("materializes deterministic profile results without writing profile.yml", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-deterministic",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
          "utf8",
        );
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));

        const baseOnly = await runProfilePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
        });
        expect(baseOnly.result.phase).toMatchObject({
          decisionMode: "deterministic",
          phase: "profile",
          signalMode: "base-only-deterministic",
        });
        expect(baseOnly.result.identity).toMatchObject({
          id: "md-pdf-profile-20260704T080000Z-abc12345",
          source: "deterministic",
          basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
        });
        expect(baseOnly.result.finalProfile.profile).toMatchObject({
          id: "md-pdf-profile-20260704T080000Z-abc12345",
          source: "deterministic",
        });
        expect(baseOnly.result.serializedProfile).toContain(
          "id: md-pdf-profile-20260704T080000Z-abc12345",
        );
        expect(await pathExists(baseOnly.outputPlan.profile.path)).toBe(false);

        const coverOnly = await runProfilePhaseFixture(fixtureDir, {
          coverImage: "cover.png",
        });
        expect(coverOnly.result.phase).toMatchObject({
          decisionMode: "deterministic",
          phase: "profile",
          signalMode: "basic-default",
        });
        expect(coverOnly.result.identity).toMatchObject({
          source: "deterministic",
          basedOn: "default",
        });
        expect(await pathExists(coverOnly.outputPlan.profile.path)).toBe(false);
      },
    );
  });

  test("runs Codex-assisted profile adaptation and preserves unmatched directions", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-codex", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "report.md"),
        "# Report\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n",
        "utf8",
      );

      const { outputPlan, result, stderr } = await runProfilePhaseFixture(fixtureDir, {
        input: "report.md",
        intent: "wide table report with custom CSS",
        profileCodexRunner: adaptedProfileRunner("wide-table", ["unsupported custom CSS"]),
      });

      expect(stderr.text).toContain(
        "Requesting Codex Markdown PDF project profile recommendation...",
      );
      expect(result.phase).toMatchObject({
        decisionMode: "adapted",
        phase: "profile",
        signalMode: "document-informed",
        warnings: ["profile warning"],
      });
      expect(result.unmatchedProfileDirections).toEqual(["unsupported custom CSS"]);
      expect(result.identity).toMatchObject({
        id: "md-pdf-profile-20260704T080000Z-abc12345",
        source: "codex",
        basedOn: "wide-table",
        preset: "wide-table",
      });
      expect(result.finalProfile).toMatchObject({
        fonts: { body: { default: "Source Serif 4" } },
        toc: { enabled: true },
      });
      expect(await pathExists(outputPlan.profile.path)).toBe(false);
    });
  });

  test("fails no-usable profile decisions without partial profile writes", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nUnsupported profile.\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "report.md",
        profileCodexRunner: noUsableProfileRunner(),
      });
      const signals = await collectMdPdfProjectCodexSignals(runtime, state);
      const outputPlan = await planMdPdfProjectCodexOutput({
        identityUidFactory: () => "abc12345",
        runtime,
        signalMode: signals.modes.project,
        state,
      });

      await expectCliError(
        () =>
          runMdPdfProjectCodexProfilePhase({
            outputPlan,
            profileCodexRunner: noUsableProfileRunner(),
            runtime,
            signals,
            state,
          }),
        { code: "MARKDOWN_PDF_PROJECT_NO_USABLE_PROFILE" },
      );
      expect(await pathExists(outputPlan.profile.path)).toBe(false);
    });
  });
});
