import { describe, expect, test } from "bun:test";
import { actionFontList } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");
const ANSI_START = `${String.fromCharCode(27)}[`;

describe("font CLI list", () => {
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

  test("keeps lookup metadata out of the font list JSON face schema", async () => {
    const { runtime, stdout } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontList(runtime, {
      json: true,
      discovery: "fontconfig",
      runner: async () => ({
        ok: true,
        stdout:
          "Noto Sans CJK JP,Noto Sans JP\tNoto Sans CJK JP Regular,Noto Sans JP Regular\tRegular\t/fonts/NotoSansCJK-Regular.otf\t\n",
        stderr: "",
      }),
    });

    const payload = JSON.parse(stdout.text) as {
      fonts: Array<Record<string, unknown>>;
    };
    expect(Object.keys(payload.fonts[0] ?? {}).sort()).toEqual(
      ["family", "format", "fullName", "path", "source", "style"].sort(),
    );
    expect(payload.fonts[0]).not.toHaveProperty("aliases");
    expect(payload.fonts[0]).not.toHaveProperty("fullNames");
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

  test("prints timeout distinctly in text debug output", async () => {
    const { runtime, stdout, stderr } = createActionTestRuntime({
      colorEnabled: false,
    });
    runtime.platform = "linux";

    await actionFontList(runtime, {
      debug: true,
      discovery: "fontconfig",
      runner: async () => ({
        ok: false,
        stdout: "",
        stderr: "private timeout detail",
        failureKind: "timeout",
      }),
    });

    expect(stdout.text).toMatch(
      /- fontconfig: timeout in \d+ms \(fontconfig discovery timed out\.\)/,
    );
    expect(stdout.text).not.toContain("private timeout detail");
    expect(stderr.text).toBe("Warning: fontconfig discovery failed.\n");
    expect(stderr.text).not.toContain("private timeout detail");
  });

  test("colors only discovery warning labels on eligible stderr", async () => {
    const { runtime, stderr } = createActionTestRuntime();
    runtime.platform = "linux";
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;

    await actionFontList(runtime, {
      discovery: "fontconfig",
      runner: async () => ({ ok: false, stdout: "", stderr: "private failure detail" }),
    });

    expect(stderr.text).toBe("\u001b[33mWarning:\u001b[39m fontconfig discovery failed.\n");
    expect(stderr.text.replace(ANSI_PATTERN, "")).toBe("Warning: fontconfig discovery failed.\n");
    expect(stderr.text.slice(stderr.text.indexOf(" fontconfig"))).not.toContain(ANSI_START);
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
