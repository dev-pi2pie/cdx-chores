import { describe, expect, test } from "bun:test";

import { checkFontconfigCoverage, fontconfigCoverageProvider } from "../src/fonts/coverage";

describe("fontconfig coverage provider", () => {
  test("checks selected font files with the fontconfig coverage provider", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = await fontconfigCoverageProvider.check({
      face: {
        family: "Noto Sans CJK TC",
        fullName: "Noto Sans CJK TC Regular",
        style: "normal",
        source: "system",
        format: "otf",
        path: "/fonts/NotoSansCJKtc-Regular.otf",
      },
      text: "A\n繁",
      runner: async (command, args) => {
        calls.push({ command, args });
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        return { ok: true, stdout: "0020-007e 7e41\n", stderr: "" };
      },
    });

    expect(result).toMatchObject({
      status: "checked",
      supportsText: true,
      checkedCodepoints: ["U+0041", "U+7E41"],
      missingCodepoints: [],
      path: "/fonts/NotoSansCJKtc-Regular.otf",
    });
    expect(calls).toEqual([
      { command: "fc-query", args: ["--version"] },
      { command: "fc-query", args: ["--format=%{charset}\\n", "/fonts/NotoSansCJKtc-Regular.otf"] },
    ]);
  });

  test("reports missing codepoints from fontconfig charset coverage", async () => {
    const result = await checkFontconfigCoverage({
      face: {
        family: "Latin",
        fullName: "Latin Regular",
        style: "normal",
        source: "system",
        path: "/fonts/Latin.ttf",
      },
      text: "AB",
      runner: async (_command, args) =>
        args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0041\n", stderr: "" },
    });

    expect(result).toMatchObject({
      status: "checked",
      supportsText: false,
      missingCodepoints: ["U+0042"],
    });
  });

  test("returns inconclusive when a selected face has no inspectable path", async () => {
    const result = await checkFontconfigCoverage({
      face: {
        family: "Virtual",
        fullName: "Virtual Regular",
        style: "normal",
        source: "system",
      },
      text: "A",
      runner: async () => {
        throw new Error("runner should not be called without a path");
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "no-inspectable-font-file",
      checkedCodepoints: ["U+0041"],
      missingCodepoints: [],
    });
  });

  test("returns inconclusive for empty required codepoints before probing fontconfig", async () => {
    const result = await checkFontconfigCoverage({
      face: {
        family: "Latin",
        fullName: "Latin Regular",
        style: "normal",
        source: "system",
        format: "ttf",
        path: "/fonts/Latin.ttf",
      },
      text: "\n\t",
      runner: async () => {
        throw new Error("runner should not be called without required codepoints");
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "empty-required-codepoints",
      checkedCodepoints: [],
      missingCodepoints: [],
      path: "/fonts/Latin.ttf",
    });
  });

  test("returns inconclusive when fontconfig is unavailable", async () => {
    const calls: string[] = [];
    const result = await checkFontconfigCoverage({
      face: {
        family: "Latin",
        fullName: "Latin Regular",
        style: "normal",
        source: "system",
        format: "ttf",
        path: "/fonts/Latin.ttf",
      },
      text: "A",
      runner: async (command) => {
        calls.push(command);
        return { ok: false, stdout: "", stderr: "fc-query not found" };
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "fontconfig-unavailable",
      path: "/fonts/Latin.ttf",
    });
    expect(calls).toEqual(["fc-query"]);
  });

  test("returns inconclusive for unsupported font formats before probing fontconfig", async () => {
    const result = await checkFontconfigCoverage({
      face: {
        family: "Web Font",
        fullName: "Web Font Regular",
        style: "normal",
        source: "system",
        format: "woff2",
        path: "/fonts/WebFont.woff2",
      },
      text: "A",
      runner: async () => {
        throw new Error("runner should not be called for unsupported font formats");
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "unsupported-font-format",
      checkedCodepoints: ["U+0041"],
      missingCodepoints: [],
      path: "/fonts/WebFont.woff2",
    });
  });

  test("returns inconclusive when fontconfig cannot query charset output", async () => {
    const failedQueryCalls: Array<{ command: string; args: string[] }> = [];
    const failedQuery = await checkFontconfigCoverage({
      face: {
        family: "Latin",
        fullName: "Latin Regular",
        style: "normal",
        source: "system",
        path: "/fonts/Latin.ttf",
      },
      text: "A",
      runner: async (command, args) => {
        failedQueryCalls.push({ command, args });
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: false, stdout: "", stderr: "query failed" };
      },
    });

    const missingCharsetCalls: Array<{ command: string; args: string[] }> = [];
    const missingCharset = await checkFontconfigCoverage({
      face: {
        family: "Latin",
        fullName: "Latin Regular",
        style: "normal",
        source: "system",
        path: "/fonts/Latin.ttf",
      },
      text: "A",
      runner: async (command, args) => {
        missingCharsetCalls.push({ command, args });
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "\n", stderr: "" };
      },
    });

    expect(failedQuery).toMatchObject({
      status: "inconclusive",
      reason: "fontconfig-query-failed",
    });
    expect(failedQueryCalls).toEqual([
      { command: "fc-query", args: ["--version"] },
      { command: "fc-query", args: ["--format=%{charset}\\n", "/fonts/Latin.ttf"] },
    ]);
    expect(missingCharset).toMatchObject({
      status: "inconclusive",
      reason: "fontconfig-charset-unavailable",
    });
    expect(missingCharsetCalls).toEqual([
      { command: "fc-query", args: ["--version"] },
      { command: "fc-query", args: ["--format=%{charset}\\n", "/fonts/Latin.ttf"] },
    ]);
  });
});
