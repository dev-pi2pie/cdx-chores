import { describe, expect, test } from "bun:test";

import { checkFontconfigCoverage } from "../src/fonts/coverage";

describe("fontconfig TTC coverage provider inconclusive paths", () => {
  test("keeps TTC coverage inconclusive without a provider-backed face index", async () => {
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
      reason: "ttc-face-index-unavailable",
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
      reason: "ttc-face-index-unavailable",
      path: "/System/Library/Fonts/System.ttc",
    });
  });

  test("keeps indexed TTC coverage inconclusive when metadata does not match selected face", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = await checkFontconfigCoverage({
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
        calls.push({ command, args });
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "Other TTC\tOther TTC Regular\n", stderr: "" };
      },
    });

    expect(result).toMatchObject({
      status: "inconclusive",
      reason: "ttc-face-mismatch",
      path: "/System/Library/Fonts/System.ttc",
    });
    expect(calls).toEqual([
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
    ]);
  });

  test("returns fontconfig query failure for indexed TTC metadata and charset failures", async () => {
    const metadataFailureCalls: Array<{ command: string; args: string[] }> = [];
    const metadataFailure = await checkFontconfigCoverage({
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
        metadataFailureCalls.push({ command, args });
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: false, stdout: "", stderr: "query failed" };
      },
    });

    const charsetFailureCalls: Array<{ command: string; args: string[] }> = [];
    const charsetFailure = await checkFontconfigCoverage({
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
        charsetFailureCalls.push({ command, args });
        if (args[0] === "--version") {
          return { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" };
        }
        if (args.includes("--format=%{family}\t%{fullname}\\n")) {
          return { ok: true, stdout: "System TTC\tSystem TTC Regular\n", stderr: "" };
        }
        return { ok: false, stdout: "", stderr: "query failed" };
      },
    });

    expect(metadataFailure).toMatchObject({
      status: "inconclusive",
      reason: "fontconfig-query-failed",
    });
    expect(metadataFailureCalls).toEqual([
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
    ]);
    expect(charsetFailure).toMatchObject({
      status: "inconclusive",
      reason: "fontconfig-query-failed",
    });
    expect(charsetFailureCalls).toEqual([
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
  });
});
