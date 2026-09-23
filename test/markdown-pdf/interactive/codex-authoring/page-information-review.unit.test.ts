import { describe, expect, test } from "bun:test";

import { renderMarkdownPdfCodexCandidateReview } from "../../../../src/cli/interactive/markdown/codex-review";
import type { PreparedMarkdownPdfCodexCandidate } from "../../../../src/cli/interactive/markdown/codex-types";
import { createCapturedRuntime } from "../../../helpers/cli-test-utils";

const pageNumbers = {
  enabled: true,
  scope: "body",
  countFrom: "body",
  start: 1,
  increment: 1,
  position: "top-left",
  format: "Section {page}\u0085\u202e\u2028\u2029",
} as const;

describe("Interactive Codex page-information review", () => {
  test("shows the entered choice with exact effective Profile text and a retained-slot warning", () => {
    const { runtime, stderr } = createCapturedRuntime();
    const candidate = {
      artifact: "profile",
      setup: {
        artifact: "profile",
        fontHints: [],
        pageInformation: {
          pageNumbers,
          occupiedNumberSlot: {
            position: "top-left",
            choice: "retain",
            conflictingText: "Author /custom/path\u001b[31m",
          },
        },
      },
      prepared: {
        kind: "profile",
        decisionMode: "deterministic",
        finalProfile: {
          pageNumbers,
          header: { left: "Author /custom/path\u001b[31m" },
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    renderMarkdownPdfCodexCandidateReview(runtime, candidate);
    const output = stderr.text;
    expect(output).toContain("Page numbers: explicit ON");
    expect(output).toContain("Codex request: not needed (deterministic)");
    expect(output).toContain("Repeating content: unspecified (preserve prepared choice)");
    expect(output).toContain("Occupied number slot: retain top-left");
    expect(output).toContain("Section {page}\\u0085\\u202e\\u2028\\u2029");
    expect(output).toContain("- Label: (matches entered label)");
    expect(output.match(/Section \{page\}/g)).toHaveLength(1);
    expect(output).toContain("Author /custom/path\\u001b[31m");
    expect(output).toContain("Retained text is stored but cannot render");
    for (const control of ["\u001b", "\u0085", "\u202e", "\u2028", "\u2029"]) {
      expect(output).not.toContain(control);
    }
  });

  test("shows Project repeating slots and actual phase modes from the prepared candidate", () => {
    const { runtime, stderr } = createCapturedRuntime();
    const candidate = {
      artifact: "project-bundle",
      setup: {
        artifact: "project-bundle",
        fontHints: [],
        pageInformation: {
          repeatingContent: {
            enabled: true,
            selected: ["bottom-right"],
            text: { "bottom-right": "Project footer\u202e" },
          },
        },
      },
      prepared: {
        profilePhase: {
          unmatchedProfileDirections: [],
          finalProfile: {
            pageNumbers,
            header: { left: "Inherited" },
            footer: { right: "Project footer\u202e" },
          },
          phase: { signalMode: "basic-default" },
        },
        templatePhase: {
          forwardedProfileDirections: [],
          phase: { signalMode: "deterministic" },
          synthesis: { unsupportedDirections: [] },
        },
        binding: {
          validation: { decisionMode: "accepted", results: [], diagnostics: { conditions: [] } },
          reportArtifact: {
            handoff: {
              profile: { id: "profile-id", bundlePath: "profile.yml" },
              capabilityRequirements: [],
              artifacts: { availability: "planned" },
              render: { usability: "unavailable" },
              diagnostics: [],
            },
            phases: {
              profile: { decisionMode: "accepted" },
              template: { decisionMode: "accepted" },
            },
            project: { signalMode: "deterministic", decisionMode: "accepted" },
            files: [],
            managedAssets: [],
            unsupportedDirections: [],
            validationResults: [],
          },
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    renderMarkdownPdfCodexCandidateReview(runtime, candidate);
    const output = stderr.text;
    expect(output).toContain("Repeating content: explicit ON at bottom-right");
    expect(output).toContain("Entered bottom-right text:");
    expect(output).toContain("Profile phase: basic-default");
    expect(output).toContain("Template phase: deterministic");
    expect(output).toContain("Effective repeating page content:");
    expect(output).toContain("Project footer\\u202e");
    expect(output).toContain("right=(matches entered text)");
    expect(output.match(/Project footer/g)).toHaveLength(1);
    expect(output).not.toContain("Project footer\u202e");
    expect(output).toContain("Page numbers at top-left replace configured header.left content");
  });
});
