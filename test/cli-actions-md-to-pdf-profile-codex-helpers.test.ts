import { describe, expect, test } from "bun:test";

import { resolveMarkdownPdfCodexProfileCandidates } from "../src/cli/markdown-pdf/profile-codex/candidates";
import { createMarkdownPdfCodexProfileIdentity } from "../src/cli/markdown-pdf/profile-codex/profile-identity";
import {
  createMarkdownPdfProfileCandidates,
  type MarkdownPdfProfileCandidate,
} from "../src/cli/markdown-pdf/profile/candidates";

function candidateIds(candidates: MarkdownPdfProfileCandidate[]): string[] {
  return candidates.map((candidate) => candidate.summary.id);
}

function baseProfileCandidate(): MarkdownPdfProfileCandidate {
  const [defaultCandidate] = createMarkdownPdfProfileCandidates();
  if (!defaultCandidate) {
    throw new Error("expected default profile candidate");
  }
  return {
    ...defaultCandidate,
    summary: {
      ...defaultCandidate.summary,
      basedOn: "md-pdf-profile-base",
      id: "base-profile",
      kind: "base-profile",
      label: "User supplied base profile",
    },
  };
}

describe("Markdown PDF profile Codex helpers", () => {
  test("resolves no-base profile candidates with stable default ordering", () => {
    const resolution = resolveMarkdownPdfCodexProfileCandidates({
      signalMode: "basic-default",
    });

    expect(candidateIds(resolution.candidates)).toEqual([
      "default",
      "article",
      "report",
      "wide-table",
      "compact",
      "reader",
    ]);
    expect(resolution.executionMode).toBe("deterministic");
    expect(resolution.strongestCandidate.summary.id).toBe("default");
    if (resolution.executionMode !== "deterministic") {
      throw new Error("expected deterministic candidate resolution");
    }
    expect(resolution.selectedCandidate.summary.id).toBe("default");
  });

  test("prepends base profiles and keeps codex-assisted modes unselected", () => {
    const baseProfile = baseProfileCandidate();

    const baseOnly = resolveMarkdownPdfCodexProfileCandidates({
      baseProfileCandidate: baseProfile,
      signalMode: "base-only-deterministic",
    });
    expect(candidateIds(baseOnly.candidates)).toEqual([
      "base-profile",
      "default",
      "article",
      "report",
      "wide-table",
      "compact",
      "reader",
    ]);
    expect(baseOnly.executionMode).toBe("deterministic");
    if (baseOnly.executionMode !== "deterministic") {
      throw new Error("expected base-only deterministic candidate resolution");
    }
    expect(baseOnly.strongestCandidate.summary.id).toBe("base-profile");
    expect(baseOnly.selectedCandidate.summary.id).toBe("base-profile");

    const mixed = resolveMarkdownPdfCodexProfileCandidates({
      baseProfileCandidate: baseProfile,
      signalMode: "mixed-with-base",
    });
    expect(mixed.executionMode).toBe("codex-assisted");
    expect(mixed.strongestCandidate.summary.id).toBe("base-profile");
    expect("selectedCandidate" in mixed).toBe(false);
  });

  test("builds deterministic and Codex profile identities from explicit lineage", () => {
    const wideTable = createMarkdownPdfProfileCandidates().find(
      (candidate) => candidate.summary.id === "wide-table",
    );
    expect(wideTable).toBeDefined();

    expect(
      createMarkdownPdfCodexProfileIdentity({
        basedOn: wideTable!.summary.basedOn ?? wideTable!.summary.id,
        createdAt: "2026-07-04T08:00:00Z",
        profileId: "md-pdf-profile-fixed",
        preset: wideTable!.summary.preset,
        source: "deterministic",
      }),
    ).toEqual({
      id: "md-pdf-profile-fixed",
      source: "deterministic",
      basedOn: "wide-table",
      preset: "wide-table",
      createdAt: "2026-07-04T08:00:00Z",
    });

    const fallbackIdentity = createMarkdownPdfCodexProfileIdentity({
      basedOn: "none",
      createdAt: "2026-07-04T08:00:00Z",
      profileId: "md-pdf-profile-fixed",
      source: "codex",
    });
    expect(fallbackIdentity).toMatchObject({
      id: "md-pdf-profile-fixed",
      source: "codex",
      basedOn: "none",
      createdAt: "2026-07-04T08:00:00Z",
    });
    expect(fallbackIdentity.preset).toBeUndefined();
  });
});
