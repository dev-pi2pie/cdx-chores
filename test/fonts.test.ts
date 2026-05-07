import { describe, expect, test } from "bun:test";

import { actionFontList } from "../src/cli/actions";
import {
  checkFontCoverage,
  discoverSystemFonts,
  NERD_FONT_SAMPLE_TEXT,
  parseFontconfigList,
  parseMacosSystemProfilerFonts,
  parseWindowsFontRegistry,
  sampleTextForLanguage,
} from "../src/fonts";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { runCli } from "./helpers/cli-test-utils";

describe("font discovery", () => {
  test("discovers Linux fonts through fontconfig with an injected runner", async () => {
    const result = await discoverSystemFonts({
      platform: "linux",
      runner: async (command, args) => {
        expect(command).toBe("fc-list");
        expect(args).toContain("--format");
        return {
          ok: true,
          stdout:
            "Noto Serif CJK TC,Noto Serif CJK TC Black\tNoto Serif CJK TC\tRegular\t/usr/share/fonts/noto/NotoSerifCJK-Regular.ttc\n",
          stderr: "",
        };
      },
    });

    expect(result.adapter).toBe("linux-fontconfig");
    expect(result.warnings).toEqual([]);
    expect(result.faces[0]).toMatchObject({
      family: "Noto Serif CJK TC",
      fullName: "Noto Serif CJK TC",
      style: "normal",
      format: "ttc",
      source: "system",
    });
  });

  test("parses fontconfig faces without requiring fontconfig on CI", () => {
    const faces = parseFontconfigList(
      "JetBrainsMono Nerd Font\tJetBrainsMono Nerd Font Mono Bold Italic\tBold Italic\t/home/user/fonts/JetBrainsMonoNerdFont-BoldItalic.ttf\n",
    );

    expect(faces).toEqual([
      {
        family: "JetBrainsMono Nerd Font",
        fullName: "JetBrainsMono Nerd Font Mono Bold Italic",
        style: "italic",
        weight: 700,
        path: "/home/user/fonts/JetBrainsMonoNerdFont-BoldItalic.ttf",
        format: "ttf",
        source: "system",
      },
    ]);
  });

  test("parses macOS system profiler font output", () => {
    const faces = parseMacosSystemProfilerFonts(
      JSON.stringify({
        SPFontsDataType: [
          {
            _name: "Source Serif 4 Regular",
            type: "OpenType",
            path: "/System/Library/Fonts/SourceSerif4.otf",
            typefaces: [
              {
                _name: "SourceSerif4-Regular",
                family: "Source Serif 4",
                fullname: "Source Serif 4 Regular",
                style: "Regular",
              },
            ],
          },
        ],
      }),
    );

    expect(faces[0]).toMatchObject({
      family: "Source Serif 4",
      fullName: "Source Serif 4 Regular",
      style: "normal",
      format: "otf",
      source: "system",
    });
  });

  test("prefers fontconfig on macOS when it is available", async () => {
    const commands: string[] = [];
    const result = await discoverSystemFonts({
      platform: "darwin",
      runner: async (command) => {
        commands.push(command);
        if (command === "fc-list") {
          return {
            ok: true,
            stdout:
              "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc\n",
            stderr: "",
          };
        }
        return { ok: false, stdout: "", stderr: "unexpected fallback" };
      },
    });

    expect(commands).toEqual(["fc-list"]);
    expect(result.adapter).toBe("macos-fontconfig");
    expect(result.discovery).toBe("auto");
    expect(result.selectionReason).toBe("macos-auto-fontconfig");
    expect(result.attempts).toBeUndefined();
    expect(result.faces[0]).toMatchObject({
      family: "PingFang TC",
      fullName: "PingFang TC Regular",
      format: "ttc",
    });
  });

  test("falls back to system profiler on macOS when fontconfig is unavailable", async () => {
    const commands: string[] = [];
    const result = await discoverSystemFonts({
      platform: "darwin",
      runner: async (command) => {
        commands.push(command);
        if (command === "fc-list") {
          return { ok: false, stdout: "", stderr: "fc-list missing" };
        }
        return {
          ok: true,
          stdout: JSON.stringify({
            SPFontsDataType: [
              {
                _name: "Source Serif 4 Regular",
                type: "OpenType",
                path: "/System/Library/Fonts/SourceSerif4.otf",
                typefaces: [
                  {
                    family: "Source Serif 4",
                    fullname: "Source Serif 4 Regular",
                    style: "Regular",
                  },
                ],
              },
            ],
          }),
          stderr: "",
        };
      },
    });

    expect(commands).toEqual(["fc-list", "system_profiler"]);
    expect(result.adapter).toBe("macos-system-profiler");
    expect(result.discovery).toBe("auto");
    expect(result.selectionReason).toBe("macos-auto-native-fallback");
    expect(result.attempts).toBeUndefined();
    expect(result.faces[0]?.family).toBe("Source Serif 4");
  });

  test("uses native macOS discovery without probing fontconfig when requested", async () => {
    const commands: string[] = [];
    const result = await discoverSystemFonts({
      platform: "darwin",
      discovery: "native",
      runner: async (command) => {
        commands.push(command);
        return {
          ok: true,
          stdout: JSON.stringify({
            SPFontsDataType: [
              {
                _name: "Source Serif 4 Regular",
                type: "OpenType",
                path: "/System/Library/Fonts/SourceSerif4.otf",
                typefaces: [
                  {
                    family: "Source Serif 4",
                    fullname: "Source Serif 4 Regular",
                    style: "Regular",
                  },
                ],
              },
            ],
          }),
          stderr: "",
        };
      },
    });

    expect(commands).toEqual(["system_profiler"]);
    expect(result.discovery).toBe("native");
    expect(result.adapter).toBe("macos-system-profiler");
    expect(result.selectionReason).toBeUndefined();
    expect(result.attempts).toBeUndefined();
  });

  test("forces fontconfig discovery on any platform when requested", async () => {
    const commands: string[] = [];
    const result = await discoverSystemFonts({
      platform: "win32",
      discovery: "fontconfig",
      runner: async (command) => {
        commands.push(command);
        return {
          ok: true,
          stdout: "JetBrains Mono\tJetBrains Mono Regular\tRegular\tC:\\Fonts\\JetBrainsMono.ttf\n",
          stderr: "",
        };
      },
    });

    expect(commands).toEqual(["fc-list"]);
    expect(result.discovery).toBe("fontconfig");
    expect(result.adapter).toBe("fontconfig");
    expect(result.faces[0]?.family).toBe("JetBrains Mono");
  });

  test("uses Windows registry discovery for native Windows mode", async () => {
    const commands: string[] = [];
    const result = await discoverSystemFonts({
      platform: "win32",
      discovery: "native",
      runner: async (command) => {
        commands.push(command);
        return {
          ok: true,
          stdout: JSON.stringify([
            {
              name: "Noto Sans CJK JP (TrueType)",
              value: "NotoSansCJKjp-Regular.otf",
            },
          ]),
          stderr: "",
        };
      },
    });

    expect(commands).toEqual(["powershell.exe"]);
    expect(result.discovery).toBe("native");
    expect(result.adapter).toBe("windows-registry");
    expect(result.faces[0]?.family).toBe("Noto Sans CJK JP");
  });

  test("parses Windows registry font output", () => {
    const faces = parseWindowsFontRegistry(
      JSON.stringify([
        {
          name: "Noto Sans CJK JP (TrueType)",
          value: "NotoSansCJKjp-Regular.otf",
        },
      ]),
    );

    expect(faces[0]).toMatchObject({
      family: "Noto Sans CJK JP",
      fullName: "Noto Sans CJK JP",
      style: "normal",
      format: "otf",
      source: "system",
    });
    expect(faces[0]?.path).toContain("NotoSansCJKjp-Regular.otf");
  });
});

describe("font CLI", () => {
  test("registers the top-level font command", () => {
    const result = runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("font");
    expect(result.stdout).toContain("Font discovery utilities");
  });

  test("registers font list options through the command layer", () => {
    const help = runCli(["font", "list", "--help"]);
    const invalidLimit = runCli(["font", "list", "--limit", "0"]);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage: cdx-chores font list [options]");
    expect(help.stdout).toContain("--json");
    expect(help.stdout).toContain("--debug");
    expect(help.stdout).toContain("--discovery <mode>");
    expect(help.stdout).toContain("--family <name>");
    expect(help.stdout).toContain("--limit <n>");
    expect(invalidLimit.exitCode).toBe(1);
    expect(invalidLimit.stderr).toContain("--limit must be a positive integer");
  });

  test("rejects invalid font discovery modes through the command layer", () => {
    const result = runCli(["font", "list", "--discovery", "bogus"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--discovery must be one of: auto, native, fontconfig");
  });

  test("prints discovered fonts as JSON with an injected runner", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontList(runtime, {
      json: true,
      family: "Noto",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Serif CJK TC\tNoto Serif CJK TC Regular\tRegular\t/usr/share/fonts/NotoSerifCJK-Regular.ttc",
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    const payload = JSON.parse(stdout.text) as {
      adapter: string;
      discovery: string;
      count: number;
      fonts: Array<{ family: string }>;
    };
    expect(payload.adapter).toBe("linux-fontconfig");
    expect(payload.discovery).toBe("auto");
    expect(payload.count).toBe(1);
    expect(payload.fonts[0]?.family).toBe("Noto Serif CJK TC");
    expectNoStderr();
  });

  test("prints debug JSON with discovery attempts", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "darwin";

    await actionFontList(runtime, {
      json: true,
      debug: true,
      runner: async (command) => {
        expect(command).toBe("fc-list");
        return {
          ok: true,
          stdout: "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc\n",
          stderr: "",
        };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      adapter: string;
      discovery: string;
      debug: { attempts: Array<{ adapter: string; status: string; message: string }> };
    };
    expect(payload.adapter).toBe("macos-fontconfig");
    expect(payload.discovery).toBe("auto");
    expect(payload.debug.attempts).toHaveLength(1);
    expect(payload.debug.attempts[0]).toMatchObject({
      adapter: "fontconfig",
      status: "success",
      message: "fontconfig discovery succeeded.",
    });
    expectNoStderr();
  });

  test("prints fallback failures in debug JSON without raw stderr", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const commands: string[] = [];
    runtime.platform = "darwin";

    await actionFontList(runtime, {
      json: true,
      debug: true,
      runner: async (command) => {
        commands.push(command);
        if (command === "fc-list") {
          return { ok: false, stdout: "", stderr: "/private/path/fc-list missing" };
        }
        return {
          ok: true,
          stdout: JSON.stringify({
            SPFontsDataType: [
              {
                _name: "Source Serif 4 Regular",
                type: "OpenType",
                path: "/System/Library/Fonts/SourceSerif4.otf",
                typefaces: [
                  {
                    family: "Source Serif 4",
                    fullname: "Source Serif 4 Regular",
                    style: "Regular",
                  },
                ],
              },
            ],
          }),
          stderr: "",
        };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      adapter: string;
      discovery: string;
      debug: {
        attempts: Array<{
          adapter: string;
          command: string;
          status: string;
          durationMs: number;
          message: string;
        }>;
      };
    };
    expect(commands).toEqual(["fc-list", "system_profiler"]);
    expect(payload.adapter).toBe("macos-system-profiler");
    expect(payload.discovery).toBe("auto");
    expect(payload.debug.attempts).toHaveLength(2);
    expect(payload.debug.attempts[0]).toMatchObject({
      adapter: "fontconfig",
      command: "fc-list",
      status: "failed",
      message: "fc-list was not available or failed.",
    });
    expect(payload.debug.attempts[0]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(payload.debug.attempts[1]).toMatchObject({
      adapter: "macos-system-profiler",
      command: "system_profiler",
      status: "success",
      message: "macOS native discovery succeeded.",
    });
    expect(stdout.text).not.toContain("/private/path");
    expectNoStderr();
  });

  test("uses full names and removes duplicate display entries", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontList(runtime, {
      family: "PingFang TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "PingFang TC\tPingFang TC Semibold\tSemibold\t/System/Library/Fonts/PingFang.ttc",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Discovery: auto");
    expect(stdout.text).toContain("Adapter: linux-fontconfig");
    expect(stdout.text).toContain("- PingFang TC Regular (normal, ttc)");
    expect(stdout.text).toContain("- PingFang TC Semibold (normal, weight 600, ttc)");
    expect(stdout.text.match(/PingFang TC Regular/g)).toHaveLength(1);
    expectNoStderr();
  });

  test("prints default auto info and sanitized failed attempts in text debug output", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const commands: string[] = [];
    runtime.platform = "darwin";

    await actionFontList(runtime, {
      debug: true,
      runner: async (command) => {
        commands.push(command);
        if (command === "fc-list") {
          return { ok: false, stdout: "", stderr: "/private/path/fc-list missing" };
        }
        return {
          ok: true,
          stdout: JSON.stringify({
            SPFontsDataType: [
              {
                _name: "Source Serif 4 Regular",
                type: "OpenType",
                path: "/System/Library/Fonts/SourceSerif4.otf",
                typefaces: [
                  {
                    family: "Source Serif 4",
                    fullname: "Source Serif 4 Regular",
                    style: "Regular",
                  },
                ],
              },
            ],
          }),
          stderr: "",
        };
      },
    });

    expect(commands).toEqual(["fc-list", "system_profiler"]);
    expect(stdout.text).toContain("Discovery: auto");
    expect(stdout.text).toContain("Adapter: macos-system-profiler");
    expect(stdout.text).toContain(
      "Info: fontconfig was unavailable, so macOS native discovery was used.",
    );
    expect(stdout.text).toContain("Debug:");
    expect(stdout.text).toMatch(
      /- fontconfig: failed in \d+ms \(fc-list was not available or failed\.\)/,
    );
    expect(stdout.text).not.toContain("/private/path");
    expect(stdout.text).toMatch(
      /- macos-system-profiler: success in \d+ms \(macOS native discovery succeeded\.\)/,
    );
    expectNoStderr();
  });

  test("does not print auto info for explicit discovery modes", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "darwin";

    await actionFontList(runtime, {
      discovery: "native",
      debug: true,
      runner: async () => ({
        ok: true,
        stdout: JSON.stringify({
          SPFontsDataType: [
            {
              _name: "Source Serif 4 Regular",
              type: "OpenType",
              path: "/System/Library/Fonts/SourceSerif4.otf",
              typefaces: [
                {
                  family: "Source Serif 4",
                  fullname: "Source Serif 4 Regular",
                  style: "Regular",
                },
              ],
            },
          ],
        }),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Discovery: native");
    expect(stdout.text).toContain("Adapter: macos-system-profiler");
    expect(stdout.text).not.toContain("Info:");
    expect(stdout.text).toMatch(
      /- macos-system-profiler: success in \d+ms \(macOS native discovery succeeded\.\)/,
    );
    expectNoStderr();
  });

  test("rejects invalid font list limits before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;

    await expectCliError(
      () =>
        actionFontList(runtime, {
          limit: 0,
          runner: async () => {
            called = true;
            return { ok: true, stdout: "", stderr: "" };
          },
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--limit must be a positive integer",
      },
    );

    expect(called).toBe(false);
    expectNoOutput();
  });
});

describe("font coverage", () => {
  test("provides controlled sample text for expanded language fixtures", () => {
    expect(sampleTextForLanguage("zh-Hant")).toBe("繁體中文測試");
    expect(sampleTextForLanguage("zh-Hans")).toBe("简体中文测试");
    expect(sampleTextForLanguage("ja")).toBe("日本語の文章");
    expect(sampleTextForLanguage("ko")).toBe("한국어 문장");
    expect(sampleTextForLanguage("vi")).toBe("Tiếng Việt");
    expect(sampleTextForLanguage("pl")).toBe("Zażółć gęślą jaźń");
    expect(sampleTextForLanguage("ar")).toBe("العربية");
    expect(sampleTextForLanguage("he")).toBe("עברית");
  });

  test("reports missing CJK glyphs from controlled sample coverage", () => {
    const coverage = checkFontCoverage({
      family: "Latin Only",
      text: "繁體中文測試",
      inventory: {
        family: "Latin Only",
        supportedRanges: [{ name: "latin", start: 0x0000, end: 0x007f }],
      },
    });

    expect(coverage.status).toBe("known");
    expect(coverage.supportsText).toBe(false);
    expect(coverage.scripts).toContain("cjk");
    expect(coverage.missingCodepoints).toContain("U+7E41");
  });

  test("reports missing Nerd Font private-use glyphs", () => {
    const coverage = checkFontCoverage({
      family: "JetBrains Mono",
      text: NERD_FONT_SAMPLE_TEXT,
      requireNerdFont: true,
      inventory: {
        family: "JetBrains Mono",
        supportedRanges: [{ name: "latin", start: 0x0000, end: 0x007f }],
        nerdFont: false,
      },
    });

    expect(coverage.supportsText).toBe(false);
    expect(coverage.nerdFont.detected).toBe(false);
    expect(coverage.nerdFont.matchedRanges).toContain("private-use");
    expect(coverage.missingCodepoints).toContain("U+E0B0");
    expect(coverage.missingCodepoints).toContain("U+F418");
  });
});
