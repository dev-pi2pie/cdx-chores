import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  deriveSiblingPreviewScopeKey,
  resolveSiblingPreviewCandidates,
} from "../src/cli/prompts/path-sibling-preview";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

describe("path sibling preview candidates", () => {
  test("resolves empty-fragment sibling browsing with directories first", async () => {
    const fixtureDir = await createTempFixtureDir("path-sibling-preview-empty-fragment");
    try {
      const docsDir = join(fixtureDir, "docs");
      await mkdir(docsDir);
      await mkdir(join(docsDir, "guides"));
      await mkdir(join(docsDir, "researches"));
      await writeFile(join(docsDir, "README.md"), "x", "utf8");

      const candidates = await resolveSiblingPreviewCandidates({
        cwd: fixtureDir,
        input: "./docs/",
        maxSuggestions: 10,
      });

      expect(candidates.replacements).toEqual([
        "./docs/guides/",
        "./docs/researches/",
        "./docs/README.md",
      ]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("keeps hidden entries out of empty-fragment browsing by default", async () => {
    const fixtureDir = await createTempFixtureDir("path-sibling-preview-hidden-empty");
    try {
      await mkdir(join(fixtureDir, "visible-dir"));
      await mkdir(join(fixtureDir, ".hidden-dir"));

      const candidates = await resolveSiblingPreviewCandidates({
        cwd: fixtureDir,
        input: "./",
        includeHidden: false,
        maxSuggestions: 10,
      });

      expect(candidates.replacements).toEqual(["./visible-dir/"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("allows explicit dot-prefix sibling browsing even when hidden suggestions are globally off", async () => {
    const fixtureDir = await createTempFixtureDir("path-sibling-preview-hidden-dot-prefix");
    try {
      await mkdir(join(fixtureDir, ".git"));
      await writeFile(join(fixtureDir, ".gitignore"), "x", "utf8");
      await writeFile(join(fixtureDir, "visible.txt"), "x", "utf8");

      const candidates = await resolveSiblingPreviewCandidates({
        cwd: fixtureDir,
        input: "./.g",
        includeHidden: false,
        maxSuggestions: 10,
      });

      expect(candidates.replacements).toEqual(["./.git/", "./.gitignore"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("scope keys are stable for the same segment scope and differ when the fragment changes", () => {
    const baseOptions = {
      cwd: "/tmp/example",
      includeHidden: false,
      maxSuggestions: 12,
      targetKind: "any" as const,
    };

    const first = deriveSiblingPreviewScopeKey({
      ...baseOptions,
      input: "./docs/re",
    });
    const second = deriveSiblingPreviewScopeKey({
      ...baseOptions,
      input: "./docs/re",
    });
    const third = deriveSiblingPreviewScopeKey({
      ...baseOptions,
      input: "./docs/gu",
    });

    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });
});
