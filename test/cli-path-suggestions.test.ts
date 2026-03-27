import { describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  resolvePathSuggestions,
  shouldSuggestForPathInput,
} from "../src/cli/prompts/path-suggestions";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

describe("path suggestion engine", () => {
  test("shouldSuggestForPathInput enforces min chars but allows explicit path prefixes", () => {
    expect(shouldSuggestForPathInput("", { minChars: 1 })).toBe(false);
    expect(shouldSuggestForPathInput("a", { minChars: 1 })).toBe(true);
    expect(shouldSuggestForPathInput("./", { minChars: 3 })).toBe(true);
    expect(shouldSuggestForPathInput("../", { minChars: 5 })).toBe(true);
    expect(shouldSuggestForPathInput("/", { minChars: 2 })).toBe(true);
  });

  test("returns directories first, then files, with trailing slash labels/replacements", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-sort");
    try {
      await mkdir(join(fixtureDir, "alpha-dir"));
      await writeFile(join(fixtureDir, "alpha-file.txt"), "x", "utf8");
      await writeFile(join(fixtureDir, "alpha-zeta.txt"), "x", "utf8");

      const suggestions = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "alpha",
        maxSuggestions: 10,
      });

      expect(suggestions.map((item) => item.label)).toEqual([
        "alpha-dir/",
        "alpha-file.txt",
        "alpha-zeta.txt",
      ]);
      expect(suggestions[0]?.kind).toBe("directory");
      expect(suggestions[0]?.replacement).toBe("alpha-dir/");
      expect(suggestions[1]?.kind).toBe("file");
      expect(suggestions[1]?.replacement).toBe("alpha-file.txt");
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("keeps hidden entries out of generic browsing by default but reveals them for explicit dot-prefix input", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-hidden");
    try {
      await writeFile(join(fixtureDir, ".secret.csv"), "x", "utf8");
      await writeFile(join(fixtureDir, "visible.csv"), "x", "utf8");

      const hiddenOffGeneric = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "",
        includeHidden: false,
        enforceTrigger: false,
      });
      const explicitDotPrefix = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: ".",
        includeHidden: false,
        enforceTrigger: false,
      });
      const hiddenOn = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "",
        includeHidden: true,
        enforceTrigger: false,
      });

      expect(hiddenOffGeneric.map((item) => item.label)).toEqual(["visible.csv"]);
      expect(explicitDotPrefix.map((item) => item.label)).toEqual([".secret.csv"]);
      expect(hiddenOn.map((item) => item.label)).toEqual([".secret.csv", "visible.csv"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("supports explicit relative prefixes like ./ and ../", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-relative-prefix");
    try {
      const childDir = join(fixtureDir, "child");
      await mkdir(childDir);
      await writeFile(join(fixtureDir, "root-file.txt"), "x", "utf8");
      await writeFile(join(childDir, "child-file.txt"), "x", "utf8");

      const currentDirSuggestions = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "./",
      });
      const parentDirSuggestions = await resolvePathSuggestions({
        cwd: childDir,
        input: "../roo",
      });

      expect(currentDirSuggestions.some((item) => item.replacement === "./child/")).toBe(true);
      expect(currentDirSuggestions.some((item) => item.replacement === "./root-file.txt")).toBe(
        true,
      );
      expect(parentDirSuggestions.map((item) => item.replacement)).toEqual(["../root-file.txt"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("supports absolute path input and preserves absolute replacement values", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-absolute");
    try {
      await writeFile(join(fixtureDir, "video.mp4"), "x", "utf8");
      await writeFile(join(fixtureDir, "video.gif"), "x", "utf8");

      const suggestions = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: `${fixtureDir}/vi`,
        targetKind: "file",
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every((item) => item.replacement.startsWith(`${fixtureDir}/`))).toBe(true);
      expect(suggestions.map((item) => item.label)).toEqual(["video.gif", "video.mp4"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("returns empty suggestions for nonexistent parent directory without throwing", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-missing-parent");
    try {
      const suggestions = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "does-not-exist/file",
      });

      expect(suggestions).toEqual([]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("can filter by target kind and file extension and caps results", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-filters");
    try {
      await mkdir(join(fixtureDir, "plans"));
      await writeFile(join(fixtureDir, "a.csv"), "x", "utf8");
      await writeFile(join(fixtureDir, "b.csv"), "x", "utf8");
      await writeFile(join(fixtureDir, "c.txt"), "x", "utf8");

      const csvOnly = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "",
        targetKind: "file",
        fileExtensions: ["csv"],
        maxSuggestions: 1,
        minChars: 0,
      });

      expect(csvOnly.map((item) => item.label)).toEqual(["a.csv"]);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("large directories still return a capped suggestion list", async () => {
    const fixtureDir = await createTempFixtureDir("path-suggestions-large-dir");
    try {
      await mkdir(join(fixtureDir, "alpha-dir"));
      for (let index = 0; index < 80; index += 1) {
        await writeFile(
          join(fixtureDir, `alpha-file-${String(index).padStart(2, "0")}.txt`),
          "x",
          "utf8",
        );
      }

      const suggestions = await resolvePathSuggestions({
        cwd: fixtureDir,
        input: "alpha",
        maxSuggestions: 12,
      });

      expect(suggestions).toHaveLength(12);
      expect(suggestions[0]?.label).toBe("alpha-dir/");
      expect(suggestions.every((item) => item.label.startsWith("alpha-"))).toBe(true);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
