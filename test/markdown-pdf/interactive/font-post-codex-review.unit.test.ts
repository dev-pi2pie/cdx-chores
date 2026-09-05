import { describe, expect, test } from "bun:test";

import { collectMarkdownPdfInteractiveFontReview } from "../../../src/cli/interactive/markdown/font-review";
import type { PreparedMarkdownPdfCodexCandidate } from "../../../src/cli/interactive/markdown/codex-types";
import { renderMarkdownPdfCodexCandidateReview } from "../../../src/cli/interactive/markdown/codex-review";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

describe("Markdown PDF Interactive post-Codex font review", () => {
  test("collects Profile accepted mappings and unresolved directions", () => {
    const candidate = {
      artifact: "profile",
      setup: { artifact: "profile", fontHints: ["Prefer Noto Serif JP for Japanese body text"] },
      prepared: {
        kind: "profile",
        result: {
          decision: {
            acceptedFontPatches: [
              { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
            ],
            unmatchedDirections: ["Keep emoji colorful"],
          },
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    expect(collectMarkdownPdfInteractiveFontReview(candidate)).toEqual({
      applied: [{ family: "Noto Serif JP", key: "ja", layer: "Profile", role: "body" }],
      blocked: [],
      unresolved: ["Keep emoji colorful"],
    });
  });

  test("separates Template applied and blocked mappings", () => {
    const candidate = {
      artifact: "template-bundle",
      setup: { artifact: "template-bundle", fontHints: ["Prefer Inter for headings"] },
      prepared: {
        synthesis: {
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              reason: "applied",
              role: "heading",
              status: "applied",
            },
            {
              family: "JetBrains Mono",
              key: "default",
              reason: "profile-font-owned",
              role: "code",
              status: "blocked",
            },
          ],
          unsupportedDirections: ["Use Brand Sans for callouts"],
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    expect(collectMarkdownPdfInteractiveFontReview(candidate)).toEqual({
      applied: [{ family: "Inter", key: "default", layer: "Template", role: "heading" }],
      blocked: [
        {
          family: "JetBrains Mono",
          key: "default",
          layer: "Template",
          reason: "profile font owned",
          role: "code",
        },
      ],
      unresolved: ["Use Brand Sans for callouts"],
    });
  });

  test("combines Project Profile and Template results with final unresolved directions", () => {
    const candidate = {
      artifact: "project-bundle",
      setup: { artifact: "project-bundle", fontHints: ["Prefer Inter"] },
      prepared: {
        profilePhase: {
          codexResult: {
            decision: {
              acceptedFontPatches: [
                { op: "replace-font", role: "pageChrome", key: "default", value: "Inter" },
              ],
            },
          },
        },
        templatePhase: {
          synthesis: {
            fontDecisions: [
              {
                family: "Source Serif 4",
                key: "default",
                reason: "applied",
                role: "body",
                status: "applied",
              },
            ],
          },
        },
        binding: { reportArtifact: { unsupportedDirections: ["Use font for side notes"] } },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    expect(collectMarkdownPdfInteractiveFontReview(candidate)).toEqual({
      applied: [
        { family: "Inter", key: "default", layer: "Profile", role: "pageChrome" },
        { family: "Source Serif 4", key: "default", layer: "Template", role: "body" },
      ],
      blocked: [],
      unresolved: ["Use font for side notes"],
    });
  });

  test("renders validated mappings without inventing font-hint provenance", () => {
    const { runtime, stderr } = createCapturedRuntime();
    const candidate = {
      artifact: "template-bundle",
      setup: { artifact: "template-bundle", fontHints: ["Prefer Inter for headings"] },
      prepared: {
        outputPlan: {
          assets: [],
          styleCss: { bundlePath: "style.css" },
          templateHtml: { bundlePath: "template.html" },
        },
        signals: { signalMode: "hint-only" },
        synthesis: {
          decisionMode: "adapted",
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              reason: "applied",
              role: "heading",
              status: "applied",
            },
          ],
          unsupportedDirections: ["Use Brand Sans for callouts"],
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    renderMarkdownPdfCodexCandidateReview(runtime, candidate);

    expect(stderr.text).toContain("Applied font mappings:\n- Template heading/default → Inter");
    expect(stderr.text).toContain("Unresolved directions:\n- Use Brand Sans for callouts");
    expect(stderr.text).not.toContain("Source: font hint");
  });
});
