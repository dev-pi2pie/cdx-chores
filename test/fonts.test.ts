import { describe, expect, test } from "bun:test";

import { actionFontInspect, actionFontList } from "../src/cli/actions";
import {
  checkFontconfigCoverage,
  fontconfigCoverageProvider,
  parseFontconfigCharset,
} from "../src/fonts/coverage";
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

  test("registers font inspect options through the command layer", () => {
    const help = runCli(["font", "inspect", "--help"]);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage: cdx-chores font inspect [options]");
    expect(help.stdout).toContain("--json");
    expect(help.stdout).toContain("--debug");
    expect(help.stdout).toContain("--discovery <mode>");
    expect(help.stdout).toContain("--family <name>");
  });

  test("rejects invalid font discovery modes through the command layer", () => {
    const result = runCli(["font", "list", "--discovery", "bogus"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--discovery must be one of: auto, native, fontconfig");
  });

  test("rejects invalid font inspect discovery modes through the command layer", () => {
    const result = runCli(["font", "inspect", "--family", "Noto", "--discovery", "bogus"]);

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

  test("rejects font inspect without a family before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;

    await expectCliError(
      () =>
        actionFontInspect(runtime, {
          runner: async () => {
            called = true;
            return { ok: true, stdout: "", stderr: "" };
          },
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--family is required for font inspect",
      },
    );

    expect(called).toBe(false);
    expectNoOutput();
  });

  test("rejects font inspect with a blank family before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;

    await expectCliError(
      () =>
        actionFontInspect(runtime, {
          family: "   ",
          runner: async () => {
            called = true;
            return { ok: true, stdout: "", stderr: "" };
          },
        }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--family is required for font inspect",
      },
    );

    expect(called).toBe(false);
    expectNoOutput();
  });

  test("prints font inspect text output with multiple faces under one family", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "PingFang TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "PingFang TC\tPingFang TC Semibold\tSemibold\t/System/Library/Fonts/PingFang.ttc",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("cdx-chores font inspect");
    expect(stdout.text).toContain("Family: PingFang TC");
    expect(stdout.text).toContain("Discovery: auto");
    expect(stdout.text).toContain("Adapter: linux-fontconfig");
    expect(stdout.text).toContain("Faces:");
    expect(stdout.text.indexOf("- PingFang TC Regular")).toBeLessThan(
      stdout.text.indexOf("- PingFang TC Semibold"),
    );
    expect(stdout.text).toContain("- PingFang TC Regular");
    expect(stdout.text).toContain("  style: normal");
    expect(stdout.text).toContain("  source: system");
    expect(stdout.text).toContain("  format: ttc");
    expect(stdout.text).toContain("- PingFang TC Semibold");
    expect(stdout.text).toContain("  weight: 600");
    expect(stdout.text).toContain("Coverage: not checked.");
    expectNoStderr();
  });

  test("prints font inspect JSON with structured matches", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      json: true,
      family: "Noto Sans CJK TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Sans CJK TC\tNoto Sans CJK TC Bold\tBold\t/usr/share/fonts/NotoSansCJK-Bold.otf",
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    const payload = JSON.parse(stdout.text) as {
      command: string;
      family: string;
      adapter: string;
      discovery: string;
      warnings: string[];
      matches: Array<{
        family: string;
        fullName: string;
        style: string;
        weight: number;
        source: string;
        format: string;
        path: string;
      }>;
    };
    expect(payload.command).toBe("font inspect");
    expect(payload.family).toBe("Noto Sans CJK TC");
    expect(payload.adapter).toBe("linux-fontconfig");
    expect(payload.discovery).toBe("auto");
    expect(payload.warnings).toEqual([]);
    expect(payload.matches).toHaveLength(1);
    expect(payload.matches[0]).toMatchObject({
      family: "Noto Sans CJK TC",
      fullName: "Noto Sans CJK TC Bold",
      style: "normal",
      weight: 700,
      source: "system",
      format: "otf",
      path: "/usr/share/fonts/NotoSansCJK-Bold.otf",
    });
    expectNoStderr();
  });

  test("omits unavailable optional font inspect metadata", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Virtual Family",
      runner: async () => ({
        ok: true,
        stdout: "Virtual Family\tVirtual Family Regular\tRegular\t\n",
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("- Virtual Family Regular");
    expect(stdout.text).toContain("  style: normal");
    expect(stdout.text).toContain("  source: system");
    expect(stdout.text).not.toContain("format:");
    expect(stdout.text).not.toContain("path:");
    expectNoStderr();

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "linux";
    await actionFontInspect(jsonRuntime.runtime, {
      json: true,
      family: "Virtual Family",
      runner: async () => ({
        ok: true,
        stdout: "Virtual Family\tVirtual Family Regular\tRegular\t\n",
        stderr: "",
      }),
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as {
      matches: Array<{ format?: string; path?: string }>;
    };
    expect(payload.matches[0]).not.toHaveProperty("format");
    expect(payload.matches[0]).not.toHaveProperty("path");
    jsonRuntime.expectNoStderr();
  });

  test("matches font inspect by full name and prints family groups", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "  noto   sans cjk tc regular  ",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Sans CJK TC\tNoto Sans CJK TC Regular\tRegular\t/usr/share/fonts/NotoSansCJK-Regular.otf",
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Family: noto   sans cjk tc regular");
    expect(stdout.text).toContain("Family group: Noto Sans CJK TC");
    expect(stdout.text).toContain("- Noto Sans CJK TC Regular");
    expectNoStderr();
  });

  test("orders font inspect family groups deterministically", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Noto",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Serif\tNoto Serif Regular\tRegular\t/usr/share/fonts/NotoSerif-Regular.otf",
          "Noto Sans\tNoto Sans Regular\tRegular\t/usr/share/fonts/NotoSans-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text.indexOf("Family group: Noto Sans")).toBeLessThan(
      stdout.text.indexOf("Family group: Noto Serif"),
    );
    expect(stdout.text.indexOf("- Noto Sans Regular")).toBeLessThan(
      stdout.text.indexOf("- Noto Serif Regular"),
    );
    expectNoStderr();
  });

  test("prints font inspect no-match text and JSON as empty discovery results", async () => {
    const textRuntime = createActionTestRuntime({ colorEnabled: false });
    textRuntime.runtime.platform = "linux";

    await actionFontInspect(textRuntime.runtime, {
      family: "Missing Family",
      runner: async () => ({
        ok: true,
        stdout:
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf\n",
        stderr: "",
      }),
    });

    expect(textRuntime.stdout.text).toContain("Family: Missing Family");
    expect(textRuntime.stdout.text).toContain("Faces: 0");
    expect(textRuntime.stdout.text).toContain("Coverage: not checked.");
    textRuntime.expectNoStderr();

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "linux";
    await actionFontInspect(jsonRuntime.runtime, {
      json: true,
      family: "Missing Family",
      runner: async () => ({
        ok: true,
        stdout:
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf\n",
        stderr: "",
      }),
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as {
      command: string;
      family: string;
      discovery: string;
      adapter: string;
      matches: unknown[];
      warnings: unknown[];
    };
    expect(payload.command).toBe("font inspect");
    expect(payload.family).toBe("Missing Family");
    expect(payload.discovery).toBe("auto");
    expect(payload.adapter).toBe("linux-fontconfig");
    expect(payload.matches).toEqual([]);
    expect(payload.warnings).toEqual([]);
    jsonRuntime.expectNoStderr();
  });

  test("preserves font inspect discovery warnings in text and JSON output", async () => {
    const textRuntime = createActionTestRuntime({ colorEnabled: false });
    textRuntime.runtime.platform = "linux";

    await actionFontInspect(textRuntime.runtime, {
      family: "Missing Family",
      discovery: "fontconfig",
      runner: async () => ({ ok: false, stdout: "", stderr: "fc-list failed" }),
    });

    expect(textRuntime.stdout.text).toContain("Faces: 0");
    expect(textRuntime.stderr.text).toContain("Warning: fontconfig discovery failed.");

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "linux";

    await actionFontInspect(jsonRuntime.runtime, {
      json: true,
      family: "Missing Family",
      discovery: "fontconfig",
      runner: async () => ({ ok: false, stdout: "", stderr: "fc-list failed" }),
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as {
      warnings: string[];
      matches: unknown[];
    };
    expect(payload.warnings).toEqual(["fontconfig discovery failed."]);
    expect(payload.matches).toEqual([]);
    jsonRuntime.expectNoStderr();
  });

  test("preserves font inspect warnings with debug attempts", async () => {
    const { runtime, stdout, stderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Missing Family",
      discovery: "fontconfig",
      debug: true,
      runner: async () => ({ ok: false, stdout: "", stderr: "fc-list failed" }),
    });

    expect(stdout.text).toContain("Debug:");
    expect(stdout.text).toMatch(
      /- fontconfig: failed in \d+ms \(fc-list was not available or failed\.\)/,
    );
    expect(stdout.text).toContain("Faces: 0");
    expect(stderr.text).toContain("Warning: fontconfig discovery failed.");
  });

  test("prints font inspect debug output with sanitized discovery attempts", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    const commands: string[] = [];
    runtime.platform = "darwin";

    await actionFontInspect(runtime, {
      family: "Source Serif 4",
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
    expect(stdout.text).toContain("Debug:");
    expect(stdout.text).toMatch(
      /- fontconfig: failed in \d+ms \(fc-list was not available or failed\.\)/,
    );
    expect(stdout.text).toMatch(
      /- macos-system-profiler: success in \d+ms \(macOS native discovery succeeded\.\)/,
    );
    expect(stdout.text).not.toContain("/private/path");
    expectNoStderr();
  });

  test("prints font inspect debug JSON with sanitized discovery attempts", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "darwin";

    await actionFontInspect(runtime, {
      family: "Source Serif 4",
      json: true,
      debug: true,
      runner: async (command) => {
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
      warnings: string[];
      debug: { attempts: Array<{ adapter: string; status: string; message: string }> };
    };
    expect(payload.adapter).toBe("macos-system-profiler");
    expect(payload.discovery).toBe("auto");
    expect(payload.warnings).toEqual([]);
    expect(payload.debug.attempts).toHaveLength(2);
    expect(payload.debug.attempts[0]).toMatchObject({
      adapter: "fontconfig",
      status: "failed",
      message: "fc-list was not available or failed.",
    });
    expect(payload.debug.attempts[1]).toMatchObject({
      adapter: "macos-system-profiler",
      status: "success",
      message: "macOS native discovery succeeded.",
    });
    expect(stdout.text).not.toContain("/private/path");
    expectNoStderr();
  });

  test("prints font inspect auto discovery info in text and JSON", async () => {
    const textRuntime = createActionTestRuntime({ colorEnabled: false });
    textRuntime.runtime.platform = "darwin";

    await actionFontInspect(textRuntime.runtime, {
      family: "PingFang TC",
      runner: async (command) => {
        expect(command).toBe("fc-list");
        return {
          ok: true,
          stdout: "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc\n",
          stderr: "",
        };
      },
    });

    expect(textRuntime.stdout.text).toContain(
      "Info: using fontconfig because fc-list is available. Use --discovery native to force macOS system_profiler.",
    );
    textRuntime.expectNoStderr();

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "darwin";
    await actionFontInspect(jsonRuntime.runtime, {
      family: "PingFang TC",
      json: true,
      runner: async (command) => {
        expect(command).toBe("fc-list");
        return {
          ok: true,
          stdout: "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc\n",
          stderr: "",
        };
      },
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as { info: string[] };
    expect(payload.info).toEqual([
      "using fontconfig because fc-list is available. Use --discovery native to force macOS system_profiler.",
    ]);
    jsonRuntime.expectNoStderr();
  });

  test("preserves font inspect warnings in debug JSON output", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Missing Family",
      discovery: "fontconfig",
      json: true,
      debug: true,
      runner: async () => ({ ok: false, stdout: "", stderr: "fc-list failed" }),
    });

    const payload = JSON.parse(stdout.text) as {
      warnings: string[];
      matches: unknown[];
      debug: { attempts: Array<{ adapter: string; status: string; message: string }> };
    };
    expect(payload.warnings).toEqual(["fontconfig discovery failed."]);
    expect(payload.matches).toEqual([]);
    expect(payload.debug.attempts).toHaveLength(1);
    expect(payload.debug.attempts[0]).toMatchObject({
      adapter: "fontconfig",
      status: "failed",
      message: "fc-list was not available or failed.",
    });
    expect(stdout.text).not.toContain("fc-list failed");
    expectNoStderr();
  });

  test("passes explicit discovery mode through font inspect", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    const commands: string[] = [];
    runtime.platform = "darwin";

    await actionFontInspect(runtime, {
      family: "Source Serif 4",
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
    expect(stdout.text).toContain("Discovery: native");
    expect(stdout.text).toContain("Adapter: macos-system-profiler");
    expectNoStderr();
  });

  test("removes duplicate font inspect entries", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "PingFang TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text.match(/PingFang TC Regular/g)).toHaveLength(1);
    expectNoStderr();
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

  test("parses fontconfig charset output into codepoint ranges", () => {
    expect(parseFontconfigCharset("0020-007e,00a0\n\t4e00-9fff invalid 0100-00ff")).toEqual([
      { name: "fontconfig-charset", start: 0x0020, end: 0x007e },
      { name: "fontconfig-charset", start: 0x00a0, end: 0x00a0 },
      { name: "fontconfig-charset", start: 0x4e00, end: 0x9fff },
    ]);
    expect(parseFontconfigCharset("00ff-0020")).toEqual([]);
  });

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

  test("keeps TTC coverage inconclusive until face-level inspection is proven", async () => {
    const result = await checkFontconfigCoverage({
      face: {
        family: "System TTC",
        fullName: "System TTC Regular",
        style: "normal",
        source: "system",
        format: "ttc",
        path: "/System/Library/Fonts/System.ttc",
      },
      text: "A",
      runner: async () => {
        throw new Error("runner should not be called for TTC coverage");
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "unsupported-ttc-collection",
      path: "/System/Library/Fonts/System.ttc",
    });
  });

  test("infers TTC coverage as inconclusive from the selected path extension", async () => {
    const result = await checkFontconfigCoverage({
      face: {
        family: "System TTC",
        fullName: "System TTC Regular",
        style: "normal",
        source: "system",
        path: "/System/Library/Fonts/System.ttc",
      },
      text: "A",
      runner: async () => {
        throw new Error("runner should not be called for inferred TTC coverage");
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "unsupported-ttc-collection",
      path: "/System/Library/Fonts/System.ttc",
    });
  });
});
