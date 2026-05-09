import { describe, expect, test } from "bun:test";

import { actionFontCheck } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";

describe("font CLI check provider results", () => {
  test("maps font check provider pass, fail, and nerd requirement results", async () => {
    const passRuntime = createActionTestRuntime();
    passRuntime.runtime.platform = "linux";
    const pass = await actionFontCheck(passRuntime.runtime, {
      json: true,
      family: "Latin",
      text: "AB",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "Latin\tLatin Regular\tRegular\t/fonts/Latin.ttf\n",
            stderr: "",
          };
        }
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0041 0042\n", stderr: "" };
      },
    });
    expect(pass).toMatchObject({ result: "pass", exitCode: 0 });
    const passPayload = JSON.parse(passRuntime.stdout.text) as {
      command: string;
      family: string;
      discovery: string;
      adapter: string;
      result: string;
      exitCode: number;
      checkedFace: string;
      path: string;
      reason: string | null;
      checkedCodepoints: string[];
      missingCodepoints: string[];
      warnings: string[];
      info: string[];
    };
    expect(passPayload).toMatchObject({
      command: "font check",
      family: "Latin",
      discovery: "fontconfig",
      adapter: "fontconfig",
      result: "pass",
      exitCode: 0,
      checkedFace: "Latin Regular",
      path: "/fonts/Latin.ttf",
      reason: null,
      checkedCodepoints: ["U+0041", "U+0042"],
      missingCodepoints: [],
      warnings: [],
      info: [],
    });

    const failRuntime = createActionTestRuntime();
    failRuntime.runtime.platform = "linux";
    const fail = await actionFontCheck(failRuntime.runtime, {
      json: true,
      family: "Latin",
      text: "AB",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "Latin\tLatin Regular\tRegular\t/fonts/Latin.ttf\n",
            stderr: "",
          };
        }
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0041\n", stderr: "" };
      },
    });
    const failPayload = JSON.parse(failRuntime.stdout.text) as {
      command: string;
      family: string;
      discovery: string;
      adapter: string;
      result: string;
      exitCode: number;
      checkedFace: string;
      path: string;
      reason: string | null;
      checkedCodepoints: string[];
      missingCodepoints: string[];
      warnings: string[];
      info: string[];
    };
    expect(fail).toMatchObject({ result: "fail", exitCode: 1 });
    expect(failPayload).toMatchObject({
      command: "font check",
      family: "Latin",
      discovery: "fontconfig",
      adapter: "fontconfig",
      result: "fail",
      exitCode: 1,
      checkedFace: "Latin Regular",
      path: "/fonts/Latin.ttf",
      reason: null,
      checkedCodepoints: ["U+0041", "U+0042"],
      missingCodepoints: ["U+0042"],
      warnings: [],
      info: [],
    });

    const nerdRuntime = createActionTestRuntime();
    nerdRuntime.runtime.platform = "linux";
    await actionFontCheck(nerdRuntime.runtime, {
      json: true,
      family: "Latin",
      text: "git",
      require: "nerd",
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "Latin\tLatin Regular\tRegular\t/fonts/Latin.ttf\n",
            stderr: "",
          };
        }
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0020-007e\n", stderr: "" };
      },
    });
    const nerdPayload = JSON.parse(nerdRuntime.stdout.text) as {
      requirements: string[];
      missingCodepoints: string[];
      warnings: string[];
      info: string[];
    };
    expect(nerdPayload.requirements).toEqual(["nerd"]);
    expect(nerdPayload.missingCodepoints).toEqual(["U+E0B0", "U+F418"]);
    expect(nerdPayload.warnings).toEqual([]);
    expect(nerdPayload.info).toEqual([]);
  });

  test("maps font check provider inconclusive reasons to exit 3", async () => {
    const scenarios: Array<{
      name: string;
      facePath: string;
      query: (args: string[]) => { ok: boolean; stdout: string; stderr: string };
      reason: string;
      expectedCommands: string[];
    }> = [
      {
        name: "missing fontconfig",
        facePath: "/fonts/Latin.ttf",
        query: () => ({ ok: false, stdout: "", stderr: "missing" }),
        reason: "fontconfig-unavailable",
        expectedCommands: ["fc-list", "fc-query"],
      },
      {
        name: "failed query",
        facePath: "/fonts/Latin.ttf",
        query: (args) =>
          args[0] === "--version"
            ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
            : { ok: false, stdout: "", stderr: "query failed" },
        reason: "fontconfig-query-failed",
        expectedCommands: ["fc-list", "fc-query", "fc-query"],
      },
      {
        name: "empty charset",
        facePath: "/fonts/Latin.ttf",
        query: (args) =>
          args[0] === "--version"
            ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
            : { ok: true, stdout: "\n", stderr: "" },
        reason: "fontconfig-charset-unavailable",
        expectedCommands: ["fc-list", "fc-query", "fc-query"],
      },
      {
        name: "unsupported format",
        facePath: "/fonts/Latin.woff2",
        query: () => {
          throw new Error("fc-query should not be called");
        },
        reason: "unsupported-font-format",
        expectedCommands: ["fc-list"],
      },
      {
        name: "ttc",
        facePath: "/fonts/System.ttc",
        query: () => {
          throw new Error("fc-query should not be called");
        },
        reason: "ttc-face-index-unavailable",
        expectedCommands: ["fc-list"],
      },
    ];

    for (const scenario of scenarios) {
      const { runtime, stdout } = createActionTestRuntime();
      const commands: string[] = [];
      runtime.platform = "linux";
      const result = await actionFontCheck(runtime, {
        json: true,
        family: "Latin",
        text: "A",
        discovery: "fontconfig",
        runner: async (command, args) => {
          commands.push(command);
          if (command === "fc-list") {
            return {
              ok: true,
              stdout: `Latin\tLatin Regular\tRegular\t${scenario.facePath}\n`,
              stderr: "",
            };
          }
          return scenario.query(args);
        },
      });
      const payload = JSON.parse(stdout.text) as {
        result: string;
        exitCode: number;
        reason: string;
      };
      expect(`${scenario.name}:${payload.reason}`).toBe(`${scenario.name}:${scenario.reason}`);
      expect(result.exitCode).toBe(3);
      expect(payload).toMatchObject({
        result: "inconclusive",
        exitCode: 3,
        reason: scenario.reason,
      });
      expect(commands).toEqual(scenario.expectedCommands);
    }
  });
});
