import { describe, expect, test } from "bun:test";

import { discoverSystemFonts } from "../src/fonts";

describe("font discovery", () => {
  test("discovers Linux fonts through fontconfig with an injected runner", async () => {
    const result = await discoverSystemFonts({
      platform: "linux",
      runner: async (command, args) => {
        expect(command).toBe("fc-list");
        expect(args).toContain("--format");
        expect(args[1]).toContain("%{index}");
        return {
          ok: true,
          stdout:
            "Noto Serif CJK TC,Noto Serif CJK TC Black\tNoto Serif CJK TC\tRegular\t/usr/share/fonts/noto/NotoSerifCJK-Regular.ttc\t2\n",
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
      faceIndex: 2,
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
});
