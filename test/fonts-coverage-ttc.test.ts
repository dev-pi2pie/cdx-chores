import { describe, expect, test } from "bun:test";

import { checkFontconfigCoverage } from "../src/fonts/coverage";

describe("fontconfig TTC coverage provider", () => {
  test("checks indexed TTC coverage through matching face metadata", async () => {
    const passCalls: Array<{ command: string; args: string[] }> = [];
    const pass = await checkFontconfigCoverage({
      face: {
        family: "System TTC",
        fullName: "System TTC Regular",
        style: "normal",
        source: "system",
        format: "ttc",
        faceIndex: 2,
        path: "/System/Library/Fonts/System.ttc",
      },
      text: "A",
      runner: async (command, args) => {
        passCalls.push({ command, args });
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        if (args.includes("--format=%{family}\t%{fullname}\\n")) {
          return { ok: true, stdout: "System TTC\tSystem TTC Regular\n", stderr: "" };
        }
        return { ok: true, stdout: "0041\n", stderr: "" };
      },
    });

    const failCalls: Array<{ command: string; args: string[] }> = [];
    const fail = await checkFontconfigCoverage({
      face: {
        family: "System TTC",
        fullName: "System TTC Regular",
        style: "normal",
        source: "system",
        format: "ttc",
        faceIndex: 2,
        path: "/System/Library/Fonts/System.ttc",
      },
      text: "AB",
      runner: async (command, args) => {
        failCalls.push({ command, args });
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        if (args.includes("--format=%{family}\t%{fullname}\\n")) {
          return { ok: true, stdout: "System TTC\tSystem TTC Regular\n", stderr: "" };
        }
        return { ok: true, stdout: "0041\n", stderr: "" };
      },
    });

    expect(pass).toMatchObject({
      status: "checked",
      supportsText: true,
      checkedCodepoints: ["U+0041"],
      missingCodepoints: [],
      path: "/System/Library/Fonts/System.ttc",
    });
    expect(passCalls).toEqual([
      { command: "fc-query", args: ["--version"] },
      {
        command: "fc-query",
        args: [
          "--index",
          "2",
          "--format=%{family}\t%{fullname}\\n",
          "/System/Library/Fonts/System.ttc",
        ],
      },
      {
        command: "fc-query",
        args: ["--index", "2", "--format=%{charset}\\n", "/System/Library/Fonts/System.ttc"],
      },
    ]);
    expect(fail).toMatchObject({
      status: "checked",
      supportsText: false,
      checkedCodepoints: ["U+0041", "U+0042"],
      missingCodepoints: ["U+0042"],
    });
    expect(failCalls).toEqual(passCalls);
  });

  test("accepts localized comma-separated TTC metadata aliases from fontconfig", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = await checkFontconfigCoverage({
      face: {
        family: "PingFang TC",
        fullName: "PingFang TC Regular,蘋方-繁 標準體,苹方-繁 常规体",
        style: "normal",
        source: "system",
        format: "ttc",
        faceIndex: 2,
        path: "/System/Library/Fonts/PingFang.ttc",
      },
      text: "繁體中文",
      runner: async (command, args) => {
        calls.push({ command, args });
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

    expect(result).toMatchObject({
      status: "checked",
      supportsText: true,
      checkedCodepoints: ["U+7E41", "U+9AD4", "U+4E2D", "U+6587"],
      missingCodepoints: [],
      path: "/System/Library/Fonts/PingFang.ttc",
    });
    expect(calls).toEqual([
      { command: "fc-query", args: ["--version"] },
      {
        command: "fc-query",
        args: [
          "--index",
          "2",
          "--format=%{family}\t%{fullname}\\n",
          "/System/Library/Fonts/PingFang.ttc",
        ],
      },
      {
        command: "fc-query",
        args: ["--index", "2", "--format=%{charset}\\n", "/System/Library/Fonts/PingFang.ttc"],
      },
    ]);
  });
});
