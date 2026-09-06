import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { expect } from "bun:test";

import type { MarkdownPdfCodexProfileRunner } from "../../../../src/adapters/codex/markdown-pdf-profile";
import type { MarkdownPdfTemplateCodexRunner } from "../../../../src/adapters/codex/markdown-pdf-template";
import {
  collectMdPdfProjectCodexSignals,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  runMdPdfProjectCodexTemplatePhase,
} from "../../../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";

export const BASE_PROFILE = [
  "profile:",
  "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
  "  source: deterministic",
  "  createdAt: 2026-01-01T00:00:00Z",
  "page:",
  "  size: Letter",
  "",
].join("\n");

export function adaptedProfileRunner(
  unmatchedDirections: string[] = [],
): MarkdownPdfCodexProfileRunner {
  return async ({ prompt }) =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: prompt.includes('"id": "base-profile"') ? "base-profile" : "article",
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: unmatchedDirections,
    });
}

export function adaptedTemplateResponse(
  fontDecisions: Array<{
    family: string;
    key: string;
    role: string;
    source: string;
    template_level: boolean;
  }> = [],
): string {
  return JSON.stringify({
    decision_mode: "adapted",
    template_family: "document-layered",
    recipe_preset: "article",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: false,
        byline: "none",
        composition: "media-first-caption",
        image_fit: "",
        image_anchor: "center",
        media_align: "center",
        media_scale: "balanced",
        text_align: "center",
        style: "none",
        orientation_bucket: "unknown",
        fit_pressure: "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: fontDecisions,
    managed_assets: [],
    warnings: [],
    unsupported_directions: [],
    fallback_reason: "",
  });
}

export function noUsableTemplateResponse(reason = "Unsupported template direction."): string {
  return JSON.stringify({
    decision_mode: "no-usable-template",
    template_family: "none",
    recipe_preset: "none",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: false,
        byline: "none",
        composition: "media-first-caption",
        image_fit: "",
        image_anchor: "center",
        media_align: "center",
        media_scale: "balanced",
        text_align: "center",
        style: "none",
        orientation_bucket: "unknown",
        fit_pressure: "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: [],
    managed_assets: [],
    warnings: [reason],
    unsupported_directions: [reason],
    fallback_reason: reason,
  });
}

export function stubTemplateRunner(response: string): MarkdownPdfTemplateCodexRunner {
  return async () => response;
}

export function expectPrivacySafeReport(reportText: string, fixtureDir: string): void {
  expect(reportText).not.toContain(fixtureDir);
  expect(reportText).not.toContain("/Users/");
  expect(reportText).not.toContain("/private/");
  expect(reportText).not.toContain("file://");
  expect(reportText).not.toContain("ssh://");
  expect(reportText).not.toContain("smb://");
  expect(reportText).not.toContain("vscode://");
  expect(reportText).not.toContain("C:\\");
  expect(reportText).not.toContain("\\\\server");
  expect(reportText).not.toContain("./secrets/");
  expect(reportText).not.toContain("../drafts/");
  expect(reportText).not.toContain("assets/internal");
  expect(reportText).not.toContain("127.0.0.1");
  expect(reportText).not.toContain("127.1");
  expect(reportText).not.toContain("2130706433");
  expect(reportText).not.toContain("[::1]");
  expect(reportText).not.toContain("localhost");
  expect(reportText).not.toContain("http://");
  expect(reportText).not.toContain("https://");
}

export async function prepareWriteValidationFixture(
  fixtureDir: string,
  baseProfile: string,
  options: { report?: boolean } = {},
) {
  await writeFile(join(fixtureDir, "base.yml"), baseProfile, "utf8");
  await writeFile(join(fixtureDir, "report.md"), "# Validation report\n\nBody content.\n", "utf8");
  const { runtime } = createActionTestRuntime({
    cwd: fixtureDir,
    now: () => new Date("2026-07-04T08:00:00.000Z"),
  });
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
    baseProfile: "base.yml",
    ...(options.report === false ? {} : { codexReportOutput: "project-validation-report.json" }),
    input: "report.md",
    output: "project-output",
  });
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  const outputPlan = await planMdPdfProjectCodexOutput({
    identityUidFactory: () => "abc12345",
    runtime,
    signalMode: signals.modes.project,
    state,
    writeMode: "bundle",
  });
  const profilePhase = await runMdPdfProjectCodexProfilePhase({
    outputPlan,
    profileCodexRunner: adaptedProfileRunner(),
    runtime,
    signals,
    state,
  });
  const templatePhase = await runMdPdfProjectCodexTemplatePhase({
    outputPlan,
    profilePhase,
    runtime,
    signals,
    state,
  });
  return { outputPlan, profilePhase, runtime, signals, state, templatePhase };
}
