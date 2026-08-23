import { describe, expect, test } from "bun:test";
import { actionFontCheck } from "../../../src/cli/actions";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";

describe("font CLI check diagnostics", () => {
  test("renders sanitized discovery warnings in text and JSON", async () => {
    const warningRuntime = createActionTestRuntime({ colorEnabled: false });
    warningRuntime.runtime.platform = "linux";
    await actionFontCheck(warningRuntime.runtime, {
      family: "Missing",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({ ok: false, stdout: "", stderr: "/private/path/fc-list failed" }),
    });
    expect(warningRuntime.stdout.text).toContain("Result: inconclusive");
    expect(warningRuntime.stderr.text).toContain("Warning: fontconfig discovery failed.");
    expect(warningRuntime.stdout.text).not.toContain("/private/path");

    const warningPayloadRuntime = createActionTestRuntime();
    warningPayloadRuntime.runtime.platform = "linux";
    await actionFontCheck(warningPayloadRuntime.runtime, {
      json: true,
      family: "Missing",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({ ok: false, stdout: "", stderr: "/private/path/fc-list failed" }),
    });
    const warningPayload = JSON.parse(warningPayloadRuntime.stdout.text) as {
      warnings: string[];
      info: string[];
    };
    expect(warningPayload.warnings).toEqual(["fontconfig discovery failed."]);
    expect(warningPayload.info).toEqual([]);
    warningPayloadRuntime.expectNoStderr();
  });

  test("renders sanitized discovery debug attempts", async () => {
    const debugRuntime = createActionTestRuntime({ colorEnabled: false });
    debugRuntime.runtime.platform = "darwin";
    await actionFontCheck(debugRuntime.runtime, {
      debug: true,
      family: "Latin",
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
                  _name: "Latin Regular",
                  type: "TrueType",
                  path: "/fonts/Latin.ttf",
                  typefaces: [
                    {
                      family: "Latin",
                      fullname: "Latin Regular",
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
    expect(debugRuntime.stdout.text).toContain("Debug:");
    expect(debugRuntime.stdout.text).toMatch(
      /- fontconfig: failed in \d+ms \(fc-list was not available or failed\.\)/,
    );
    expect(debugRuntime.stdout.text).toMatch(
      /- macos-system-profiler: success in \d+ms \(macOS native discovery succeeded\.\)/,
    );
    expect(debugRuntime.stdout.text).not.toContain("/private/path");
    debugRuntime.expectNoStderr();
  });
});
