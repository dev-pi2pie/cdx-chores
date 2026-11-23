import { describe, expect, test } from "bun:test";
import { posix, win32 } from "node:path";

import { isContainedRelativePath, isUnrootedFilePath } from "../../src/utils/paths";

describe("relative path containment", () => {
  test.each([posix, win32])("uses segment boundaries and explicit root equality", (pathApi) => {
    expect(isContainedRelativePath(pathApi.join("..draft", "report.txt"), { pathApi })).toBe(true);
    expect(isContainedRelativePath(pathApi.join("..", "report.txt"), { pathApi })).toBe(false);
    expect(isContainedRelativePath(`draft${pathApi.sep}..${pathApi.sep}`, { pathApi })).toBe(false);
    expect(isContainedRelativePath("", { pathApi, allowEqual: true })).toBe(true);
  });

  test("rejects relative results across Windows drives or UNC shares", () => {
    const drivePath = win32.relative("C:\\workspace", "D:\\workspace\\report.txt");
    const sharePath = win32.relative("\\\\host\\a\\workspace", "\\\\host\\b\\report.txt");
    expect(isContainedRelativePath(drivePath, { pathApi: win32 })).toBe(false);
    expect(isContainedRelativePath(sharePath, { pathApi: win32 })).toBe(false);
  });

  test("rejects Windows paths with a drive, root, or ambiguous file components", () => {
    for (const value of [
      "C:report.txt",
      "\\report.txt",
      "folder.\\report.txt",
      "folder \\report.txt",
      "report.txt:stream",
    ]) {
      expect(isUnrootedFilePath(value, win32)).toBe(false);
    }
    expect(isUnrootedFilePath("..draft\\report.txt", win32)).toBe(true);
    expect(isUnrootedFilePath("report.txt:stream", posix)).toBe(true);
  });
});
