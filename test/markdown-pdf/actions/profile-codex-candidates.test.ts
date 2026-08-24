import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizeMarkdownPdfProfile } from "../../../src/cli/markdown-pdf";
import {
  createMarkdownPdfProfileCandidates,
  loadMarkdownPdfBaseProfileCandidate,
} from "../../../src/cli/markdown-pdf/profile/candidates";
import { expectCliError } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("Markdown PDF Codex profile candidates", () => {
  test("builds distinct default and preset-backed candidates", () => {
    const candidates = createMarkdownPdfProfileCandidates();
    const defaultCandidate = candidates.find((candidate) => candidate.summary.id === "default");
    const articleCandidate = candidates.find((candidate) => candidate.summary.id === "article");
    const wideTableCandidate = candidates.find(
      (candidate) => candidate.summary.id === "wide-table",
    );

    expect(defaultCandidate?.summary).toMatchObject({
      kind: "default",
      presetBacked: false,
    });
    expect(defaultCandidate?.summary.preset).toBeUndefined();
    expect(defaultCandidate?.fullProfile.pageNumbers).toEqual({
      enabled: false,
      scope: "body",
      countFrom: "document",
      start: 1,
      increment: 1,
      position: "bottom-center",
      format: "{page}",
    });
    expect(articleCandidate?.summary).toMatchObject({
      kind: "preset",
      presetBacked: true,
      preset: "article",
    });
    expect(wideTableCandidate?.summary).toMatchObject({
      kind: "preset",
      presetBacked: true,
      preset: "wide-table",
    });
    expect(wideTableCandidate?.fullProfile.page).toMatchObject({
      orientation: "landscape",
      marginTop: "12mm",
    });
  });

  test("loads valid base profiles and rejects invalid base profiles", async () => {
    await withTempFixtureDir("md-pdf-profile-base-candidate", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const legacyPath = join(fixtureDir, "legacy.yml");
      const invalidPath = join(fixtureDir, "invalid.yml");
      await writeFile(
        basePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: wide-table",
          "  preset: wide-table",
          "  createdAt: 2026-06-15T08:15:00Z",
          "page:",
          "  orientation: landscape",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(invalidPath, "page:\n  unexpected: true\n", "utf8");
      await writeFile(
        legacyPath,
        ["page:", "  size: Letter", "fonts:", "  body:", "    default: Source Serif 4", ""].join(
          "\n",
        ),
        "utf8",
      );

      const candidate = await loadMarkdownPdfBaseProfileCandidate({
        path: toRepoRelativePath(basePath),
      });

      expect(candidate.summary).toMatchObject({
        kind: "base-profile",
        presetBacked: true,
        preset: "wide-table",
        basedOn: "md-pdf-profile-20260615T081500Z-a1b2c3d4",
      });
      expect(candidate.summary.traits).toMatchObject({
        bestFor: ["user supplied base profile"],
        density: "wide",
      });
      expect(candidate.summary.traits.bestFor).not.toContain("wide tables");
      expect(candidate.identity?.id).toBe("md-pdf-profile-20260615T081500Z-a1b2c3d4");

      const legacyCandidate = await loadMarkdownPdfBaseProfileCandidate({
        path: toRepoRelativePath(legacyPath),
      });
      expect(legacyCandidate.summary).toMatchObject({
        kind: "base-profile",
        presetBacked: false,
        preset: undefined,
        basedOn: "untracked-base-profile",
      });
      expect(legacyCandidate.identity).toBeUndefined();
      expect(legacyCandidate.fullProfile).not.toHaveProperty("pageNumbers");
      expect(
        normalizeMarkdownPdfProfile({ profile: legacyCandidate.fullProfile }).profile.pageNumbers,
      ).toEqual({
        enabled: false,
        scope: "body",
        countFrom: "document",
        start: 1,
        increment: 1,
        position: "bottom-center",
        format: "{page}",
      });

      await expectCliError(
        () => loadMarkdownPdfBaseProfileCandidate({ path: toRepoRelativePath(invalidPath) }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown Markdown PDF profile key",
        },
      );
    });
  });
});
