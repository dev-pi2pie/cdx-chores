import { describe, expect, test } from "bun:test";
import { createMdPdfProjectCodexIdentity } from "../../../../src/cli/markdown-pdf/project-codex";

describe("cli action modules: md pdf-project codex output planning", () => {
  test("generates shared project, profile, and template identities", () => {
    expect(
      createMdPdfProjectCodexIdentity({
        now: new Date("2026-07-04T01:02:03.000Z"),
        attempt: 0,
        outputDirectory: "/tmp/project",
        identityUidFactory: () => "fixed001",
      }),
    ).toEqual({
      createdAt: "2026-07-04T01:02:03Z",
      outputDirectory: "/tmp/project",
      profileId: "md-pdf-profile-20260704T010203Z-fixed001",
      projectBundleId: "md-pdf-project-20260704T010203Z-fixed001",
      templateBundleId: "md-pdf-template-20260704T010203Z-fixed001",
    });
    expect(
      createMdPdfProjectCodexIdentity({
        now: new Date("2026-07-04T01:02:03.000Z"),
        attempt: 0,
        outputDirectory: "/tmp/project",
      }).projectBundleId,
    ).toMatch(/^md-pdf-project-20260704T010203Z-[0-9a-f]{8}$/);
  });
});
