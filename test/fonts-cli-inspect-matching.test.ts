import { describe, expect, test } from "bun:test";
import { actionFontInspect } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";

describe("font CLI inspect matching", () => {
  test("matches font inspect by full name and prints family groups", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "  noto   sans cjk tc regular  ",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Sans CJK TC\tNoto Sans CJK TC Regular\tRegular\t/usr/share/fonts/NotoSansCJK-Regular.otf",
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Family: noto   sans cjk tc regular");
    expect(stdout.text).toContain("Family group: Noto Sans CJK TC");
    expect(stdout.text).toContain("- Noto Sans CJK TC Regular");
    expectNoStderr();
  });

  test("orders font inspect family groups deterministically", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Noto",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Serif\tNoto Serif Regular\tRegular\t/usr/share/fonts/NotoSerif-Regular.otf",
          "Noto Sans\tNoto Sans Regular\tRegular\t/usr/share/fonts/NotoSans-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text.indexOf("Family group: Noto Sans")).toBeLessThan(
      stdout.text.indexOf("Family group: Noto Serif"),
    );
    expect(stdout.text.indexOf("- Noto Sans Regular")).toBeLessThan(
      stdout.text.indexOf("- Noto Serif Regular"),
    );
    expectNoStderr();
  });

  test("prints font inspect no-match text and JSON as empty discovery results", async () => {
    const textRuntime = createActionTestRuntime({ colorEnabled: false });
    textRuntime.runtime.platform = "linux";

    await actionFontInspect(textRuntime.runtime, {
      family: "Missing Family",
      runner: async () => ({
        ok: true,
        stdout:
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf\n",
        stderr: "",
      }),
    });

    expect(textRuntime.stdout.text).toContain("Family: Missing Family");
    expect(textRuntime.stdout.text).toContain("Faces: 0");
    expect(textRuntime.stdout.text).toContain("Coverage: not checked.");
    textRuntime.expectNoStderr();

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "linux";
    await actionFontInspect(jsonRuntime.runtime, {
      json: true,
      family: "Missing Family",
      runner: async () => ({
        ok: true,
        stdout:
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf\n",
        stderr: "",
      }),
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as {
      command: string;
      family: string;
      discovery: string;
      adapter: string;
      matches: unknown[];
      warnings: unknown[];
    };
    expect(payload.command).toBe("font inspect");
    expect(payload.family).toBe("Missing Family");
    expect(payload.discovery).toBe("auto");
    expect(payload.adapter).toBe("linux-fontconfig");
    expect(payload.matches).toEqual([]);
    expect(payload.warnings).toEqual([]);
    jsonRuntime.expectNoStderr();
  });

  test("removes duplicate font inspect entries", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "PingFang TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text.match(/PingFang TC Regular/g)).toHaveLength(1);
    expectNoStderr();
  });
});

describe("font coverage", () => {});
