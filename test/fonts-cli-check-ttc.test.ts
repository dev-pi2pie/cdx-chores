import { describe, expect, test } from "bun:test";

import { actionFontCheck } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";

describe("font CLI check TTC output", () => {
  test("prints font check TTC mismatch text output with selected face context", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontCheck(runtime, {
      family: "System",
      text: "A",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "System\tSystem Regular\tRegular\t/System/Library/Fonts/System.ttc\t4\n",
            stderr: "",
          };
        }
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        return { ok: true, stdout: "Other\tOther Regular\n", stderr: "" };
      },
    });

    expect(stdout.text).toContain("Result: inconclusive");
    expect(stdout.text).toContain("Checked face: System Regular");
    expect(stdout.text).toContain("Path: /System/Library/Fonts/System.ttc");
    expect(stdout.text).toContain("Reason: indexed TTC metadata does not match the selected face.");
    expectNoStderr();
  });

  test("prints font check TTC JSON inconclusive output for indexed face mismatch", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const commands: Array<{ command: string; args: string[] }> = [];
    runtime.platform = "linux";

    const result = await actionFontCheck(runtime, {
      json: true,
      family: "System",
      text: "A",
      discovery: "fontconfig",
      runner: async (command, args) => {
        commands.push({ command, args });
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "System\tSystem Regular\tRegular\t/System/Library/Fonts/System.ttc\t4\n",
            stderr: "",
          };
        }
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        return { ok: true, stdout: "Other\tOther Regular\n", stderr: "" };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      result: string;
      exitCode: number;
      reason: string;
    };
    expect(result.exitCode).toBe(3);
    expect(payload).toMatchObject({
      result: "inconclusive",
      exitCode: 3,
      reason: "ttc-face-mismatch",
    });
    expect(commands).toEqual([
      {
        command: "fc-list",
        args: ["--format", "%{family}\t%{fullname}\t%{style}\t%{file}\t%{index}\n"],
      },
      { command: "fc-query", args: ["--version"] },
      {
        command: "fc-query",
        args: [
          "--index",
          "4",
          "--format=%{family}\t%{fullname}\\n",
          "/System/Library/Fonts/System.ttc",
        ],
      },
    ]);
    expectNoStderr();
  });

  test("maps indexed TTC query failure through font check JSON output", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    const result = await actionFontCheck(runtime, {
      json: true,
      family: "System",
      text: "A",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "System\tSystem Regular\tRegular\t/System/Library/Fonts/System.ttc\t4\n",
            stderr: "",
          };
        }
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        if (args.includes("--format=%{family}\t%{fullname}\\n")) {
          return { ok: true, stdout: "System\tSystem Regular\n", stderr: "" };
        }
        return { ok: false, stdout: "", stderr: "query failed" };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      result: string;
      exitCode: number;
      reason: string;
      checkedFace: string;
      path: string;
    };
    expect(result.exitCode).toBe(3);
    expect(payload).toMatchObject({
      result: "inconclusive",
      exitCode: 3,
      reason: "fontconfig-query-failed",
      checkedFace: "System Regular",
      path: "/System/Library/Fonts/System.ttc",
    });
    expectNoStderr();
  });

  test("passes font check for localized TTC metadata aliases", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    const result = await actionFontCheck(runtime, {
      json: true,
      family: "PingFang TC",
      text: "繁體中文",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout:
              "PingFang TC\tPingFang TC Regular,蘋方-繁 標準體,苹方-繁 常规体\tRegular\t/System/Library/Fonts/PingFang.ttc\t2\n",
            stderr: "",
          };
        }
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        if (args.includes("--format=%{family}\t%{fullname}\\n")) {
          return {
            ok: true,
            stdout:
              "PingFang TC,蘋方-繁,苹方-繁\tPingFang TC Regular,蘋方-繁 標準體,苹方-繁 常规体\n",
            stderr: "",
          };
        }
        return { ok: true, stdout: "4e00-9fff\n", stderr: "" };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      result: string;
      exitCode: number;
      reason: string | null;
      checkedFace: string;
      path: string;
    };
    expect(result.exitCode).toBe(0);
    expect(payload).toMatchObject({
      result: "pass",
      exitCode: 0,
      reason: null,
      checkedFace: "PingFang TC Regular,蘋方-繁 標準體,苹方-繁 常规体",
      path: "/System/Library/Fonts/PingFang.ttc",
    });
    expectNoStderr();
  });

  test("prints font check debug JSON with sanitized discovery attempts", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "darwin";

    await actionFontCheck(runtime, {
      json: true,
      debug: true,
      family: "Source Serif 4",
      text: "A",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return { ok: false, stdout: "", stderr: "/private/path/fc-list missing" };
        }
        if (command === "system_profiler") {
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
        }
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0041\n", stderr: "" };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      result: string;
      warnings: string[];
      info: string[];
      debug: { attempts: Array<{ adapter: string; status: string; message: string }> };
    };
    expect(payload.result).toBe("pass");
    expect(payload.warnings).toEqual([]);
    expect(payload.info).toEqual([
      "fontconfig was unavailable, so macOS native discovery was used.",
    ]);
    expect(payload.debug.attempts).toHaveLength(2);
    expect(payload.debug.attempts[0]).toMatchObject({
      adapter: "fontconfig",
      status: "failed",
      message: "fc-list was not available or failed.",
    });
    expect(stdout.text).not.toContain("/private/path");
    expectNoStderr();
  });
});
