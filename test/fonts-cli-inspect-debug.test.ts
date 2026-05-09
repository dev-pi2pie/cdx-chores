import { describe, expect, test } from "bun:test";

import { actionFontInspect } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";

describe("font CLI inspect debug", () => {
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
});
