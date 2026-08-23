import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareMarkdownPdfCodexCandidate } from "../../src/cli/interactive/markdown/codex-service";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng } from "../markdown-pdf/actions/template-codex-fixtures";

const PROFILE_WITH_OWNED_FONTS = [
  "profile:",
  "  id: md-pdf-profile-20260727T000000Z-1a2b3c4d",
  "  source: deterministic",
  "  createdAt: 2026-07-27T00:00:00Z",
  "pdf:",
  "  content-langs:",
  "    - ja",
  "fonts:",
  "  body:",
  "    default: Profile Body",
  "    ja: Profile Japanese",
  "  heading:",
  "    default: Profile Heading",
  "  code:",
  "    default: Profile Code",
  "    symbols: Profile Symbols",
  "  pageChrome:",
  "    default: Profile Chrome",
  "",
].join("\n");

function cssRuleBodies(styleCss: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^{}]*)\\}`, "gu");
  return [...styleCss.matchAll(pattern)].map((match) => match[1] ?? "");
}

function expectSelectorOmitsFontFamily(
  styleCss: string,
  selector: string,
  requireRule = true,
): void {
  const bodies = cssRuleBodies(styleCss, selector);
  if (requireRule) {
    expect(bodies.length).toBeGreaterThan(0);
  }
  expect(bodies.every((body) => !body.includes("font-family:"))).toBe(true);
}

function expectSelectorDeclaresFontFamily(styleCss: string, selector: string): void {
  const bodies = cssRuleBodies(styleCss, selector);
  expect(bodies.some((body) => body.includes("font-family:"))).toBe(true);
}

function expectProfileOwnedFamiliesSuppressed(styleCss: string): void {
  expectSelectorOmitsFontFamily(styleCss, "body");
  expectSelectorOmitsFontFamily(styleCss, "h1, h2, h3, h4, h5, h6");
  expectSelectorOmitsFontFamily(styleCss, "code", false);
  expect(styleCss).not.toContain(":lang(ja)");
  expect(styleCss).not.toContain("Profile Body");
  expect(styleCss).not.toContain("Profile Japanese");
  expect(styleCss).not.toContain("Profile Heading");
  expect(styleCss).not.toContain("Profile Code");
  expect(styleCss).not.toContain("Profile Symbols");
  expect(styleCss).not.toContain("Profile Chrome");
}

describe("Interactive Markdown PDF Codex service Profile font ownership", () => {
  test("inherits Profile ownership suppression for Template preparation", async () => {
    await withTempFixtureDir(
      "md-pdf-interactive-codex-template-font-ownership",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "profile.yml"), PROFILE_WITH_OWNED_FONTS, "utf8");
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

        const candidate = await prepareMarkdownPdfCodexCandidate(runtime, {
          artifact: "template-bundle",
          baseProfile: "profile.yml",
          fontHints: [],
        });

        expect(candidate.artifact).toBe("template-bundle");
        if (candidate.artifact !== "template-bundle") {
          throw new Error("Expected a prepared Template candidate.");
        }
        expect(candidate.prepared.signals.signalMode).toBe("base-profile-only");
        expectProfileOwnedFamiliesSuppressed(candidate.prepared.synthesis.styleCss);
      },
    );
  });

  test("inherits final Project Profile ownership suppression for Project preparation", async () => {
    await withTempFixtureDir(
      "md-pdf-interactive-codex-project-font-ownership",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "profile.yml"), PROFILE_WITH_OWNED_FONTS, "utf8");
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

        const candidate = await prepareMarkdownPdfCodexCandidate(runtime, {
          artifact: "project-bundle",
          baseProfile: "profile.yml",
          fontHints: [],
        });

        expect(candidate.artifact).toBe("project-bundle");
        if (candidate.artifact !== "project-bundle") {
          throw new Error("Expected a prepared Project candidate.");
        }
        expect(candidate.prepared.templatePhase.phase.signalMode).toBe("base-profile-only");
        expectProfileOwnedFamiliesSuppressed(candidate.prepared.templatePhase.synthesis.styleCss);
      },
    );
  });

  test("keeps Template fallback families when no real base Profile owns them", async () => {
    await withTempFixtureDir(
      "md-pdf-interactive-codex-template-fallback-fonts",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

        const candidate = await prepareMarkdownPdfCodexCandidate(runtime, {
          artifact: "template-bundle",
          coverImage: "cover.png",
          fontHints: [],
        });

        expect(candidate.artifact).toBe("template-bundle");
        if (candidate.artifact !== "template-bundle") {
          throw new Error("Expected a prepared Template candidate.");
        }
        expect(candidate.prepared.signals.signalMode).toBe("cover-image-only");
        expectSelectorDeclaresFontFamily(candidate.prepared.synthesis.styleCss, "body");
        expectSelectorDeclaresFontFamily(
          candidate.prepared.synthesis.styleCss,
          "h1, h2, h3, h4, h5, h6",
        );
        expectSelectorDeclaresFontFamily(candidate.prepared.synthesis.styleCss, "code");
      },
    );
  });
});
