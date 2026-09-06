import { describe, expect, test } from "bun:test";
import { actionFontCheck } from "../../../src/cli/actions/font-check";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";

describe("font CLI check output", () => {
  test("prints pass and fail text with selected-face context", async () => {
    const passRuntime = createActionTestRuntime({ colorEnabled: false });
    passRuntime.runtime.platform = "linux";

    await actionFontCheck(passRuntime.runtime, {
      family: "Latin",
      text: "A",
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
    expect(passRuntime.stdout.text).toContain("Result: pass");
    expect(passRuntime.stdout.text).toContain("Checked face: Latin Regular");
    passRuntime.expectNoStderr();

    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "darwin";

    await actionFontCheck(runtime, {
      family: "Latin",
      text: "AB",
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

    expect(stdout.text).toContain("cdx-chores font check");
    expect(stdout.text).toContain("Family: Latin");
    expect(stdout.text).toContain("Checked face: Latin Regular");
    expect(stdout.text).toContain("Path: /fonts/Latin.ttf");
    expect(stdout.text).toContain("Result: fail");
    expect(stdout.text).toContain("Missing codepoints:");
    expect(stdout.text).toContain("- U+0042");
    expect(stdout.text).toContain(
      "Info: fontconfig was unavailable, so macOS native discovery was used.",
    );
    expect(stdout.text).not.toContain("/private/path");
    expectNoStderr();
  });

  test("prints Nerd requirement gaps", async () => {
    const requirementRuntime = createActionTestRuntime({ colorEnabled: false });
    requirementRuntime.runtime.platform = "linux";
    await actionFontCheck(requirementRuntime.runtime, {
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
    expect(requirementRuntime.stdout.text).toContain("Requirement: nerd");
    expect(requirementRuntime.stdout.text).toContain("- U+E0B0");
    expect(requirementRuntime.stdout.text).toContain("- U+F418");
    requirementRuntime.expectNoStderr();
  });

  test("prints no-match inconclusive text without a selected face", async () => {
    const noMatchRuntime = createActionTestRuntime({ colorEnabled: false });
    noMatchRuntime.runtime.platform = "linux";
    await actionFontCheck(noMatchRuntime.runtime, {
      family: "Missing",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({
        ok: true,
        stdout: "Latin\tLatin Regular\tRegular\t/fonts/Latin.ttf\n",
        stderr: "",
      }),
    });
    expect(noMatchRuntime.stdout.text).toContain("Checked face: (none)");
    expect(noMatchRuntime.stdout.text).toContain("Result: inconclusive");
    expect(noMatchRuntime.stdout.text).toContain(
      "Reason: no discovered font face matched the requested family.",
    );
    noMatchRuntime.expectNoStderr();
  });

  test("prints ambiguous-family inconclusive text without a path", async () => {
    const ambiguousRuntime = createActionTestRuntime({ colorEnabled: false });
    ambiguousRuntime.runtime.platform = "linux";
    await actionFontCheck(ambiguousRuntime.runtime, {
      family: "Noto",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Sans\tNoto Sans Regular\tRegular\t/fonts/NotoSans.otf",
          "Noto Serif\tNoto Serif Regular\tRegular\t/fonts/NotoSerif.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });
    expect(ambiguousRuntime.stdout.text).toContain(
      "Reason: family query matched multiple discovered families. Use an exact family name.",
    );
    expect(ambiguousRuntime.stdout.text).toContain("Checked face: (none)");
    expect(ambiguousRuntime.stdout.text).toContain("Result: inconclusive");
    expect(ambiguousRuntime.stdout.text).not.toContain("Path:");
    ambiguousRuntime.expectNoStderr();
  });

  test("prints pathless-face inconclusive text", async () => {
    const noPathRuntime = createActionTestRuntime({ colorEnabled: false });
    noPathRuntime.runtime.platform = "linux";
    await actionFontCheck(noPathRuntime.runtime, {
      family: "Virtual",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({
        ok: true,
        stdout: "Virtual\tVirtual Regular\tRegular\t\n",
        stderr: "",
      }),
    });
    expect(noPathRuntime.stdout.text).toContain("Checked face: Virtual Regular");
    expect(noPathRuntime.stdout.text).toContain(
      "Reason: matched font has no inspectable font file path.",
    );
    noPathRuntime.expectNoStderr();
  });

  test("prints font check inconclusive text output with a reason", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontCheck(runtime, {
      family: "System",
      text: "A",
      discovery: "fontconfig",
      runner: async () => ({
        ok: true,
        stdout: "System\tSystem Regular\tRegular\t/System/Library/Fonts/System.ttc\n",
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Result: inconclusive");
    expect(stdout.text).toContain("Checked face: System Regular");
    expect(stdout.text).toContain("Path: /System/Library/Fonts/System.ttc");
    expect(stdout.text).toContain("Reason: matched TTC face has no provider-backed face index.");
    expectNoStderr();
  });
});
