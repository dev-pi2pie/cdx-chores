import { describe, expect, test } from "bun:test";
import { actionFontCheck } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";

describe("font CLI check selection", () => {
  test("selects one deterministic font check face before checking coverage", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const queriedPaths: string[] = [];
    runtime.platform = "linux";

    await actionFontCheck(runtime, {
      json: true,
      family: "Latin",
      text: "A",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: [
              "Latin\tLatin Italic\tItalic\t/fonts/Latin-Italic.ttf",
              "Latin\tLatin Bold\tBold\t/fonts/Latin-Bold.ttf",
              "Latin\tLatin Regular\tRegular\t/fonts/Latin-Regular.ttf",
              "Latin\tLatin Aardvark\tRegular\t",
              "",
            ].join("\n"),
            stderr: "",
          };
        }
        if (args[0] !== "--version") {
          queriedPaths.push(args[1] as string);
        }
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0041\n", stderr: "" };
      },
    });

    const payload = JSON.parse(stdout.text) as { checkedFace: string; path: string };
    expect(payload.checkedFace).toBe("Latin Regular");
    expect(payload.path).toBe("/fonts/Latin-Regular.ttf");
    expect(queriedPaths).toEqual(["/fonts/Latin-Regular.ttf"]);
    expectNoStderr();
  });

  test("keeps no-match and ambiguous font check family results inconclusive", async () => {
    const noMatchRuntime = createActionTestRuntime();
    noMatchRuntime.runtime.platform = "linux";
    const noMatchResult = await actionFontCheck(noMatchRuntime.runtime, {
      json: true,
      family: "Missing",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({
        ok: true,
        stdout: "Source Serif\tSource Serif Regular\tRegular\t/fonts/SourceSerif.otf\n",
        stderr: "",
      }),
    });
    const noMatchPayload = JSON.parse(noMatchRuntime.stdout.text) as {
      result: string;
      exitCode: number;
      reason: string;
      checkedFace: string | null;
      warnings: string[];
      info: string[];
    };
    expect(noMatchResult).toMatchObject({
      result: "inconclusive",
      exitCode: 3,
      reason: "no-matching-family",
    });
    expect(noMatchPayload).toMatchObject({
      result: "inconclusive",
      exitCode: 3,
      reason: "no-matching-family",
      checkedFace: null,
    });
    expect(noMatchPayload.warnings).toEqual([]);
    expect(noMatchPayload.info).toEqual([]);

    const ambiguousRuntime = createActionTestRuntime();
    ambiguousRuntime.runtime.platform = "linux";
    const commands: string[] = [];
    await actionFontCheck(ambiguousRuntime.runtime, {
      json: true,
      family: "Noto",
      text: "A",
      discovery: "fontconfig",
      runner: async (command) => {
        commands.push(command);
        return {
          ok: true,
          stdout: [
            "Noto Sans\tNoto Sans Regular\tRegular\t/fonts/NotoSans.otf",
            "Noto Serif\tNoto Serif Regular\tRegular\t/fonts/NotoSerif.otf",
            "",
          ].join("\n"),
          stderr: "",
        };
      },
    });
    const ambiguousPayload = JSON.parse(ambiguousRuntime.stdout.text) as {
      result: string;
      exitCode: number;
      reason: string;
      checkedFace: string | null;
      path: string | null;
    };
    expect(ambiguousPayload).toMatchObject({
      result: "inconclusive",
      exitCode: 3,
      reason: "ambiguous-family",
      checkedFace: null,
      path: null,
    });
    expect(commands).toEqual(["fc-list"]);
  });

  test("reports selected no-path font check faces as inconclusive", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const commands: string[] = [];
    runtime.platform = "linux";

    await actionFontCheck(runtime, {
      json: true,
      family: "Virtual",
      text: "A",
      discovery: "fontconfig",
      runner: async (command) => {
        commands.push(command);
        return {
          ok: true,
          stdout: "Virtual\tVirtual Regular\tRegular\t\n",
          stderr: "",
        };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      result: string;
      reason: string;
      checkedFace: string;
      path: string | null;
    };
    expect(payload).toMatchObject({
      result: "inconclusive",
      reason: "no-inspectable-font-file",
      checkedFace: "Virtual Regular",
      path: null,
    });
    expect(commands).toEqual(["fc-list"]);
    expectNoStderr();
  });
});
