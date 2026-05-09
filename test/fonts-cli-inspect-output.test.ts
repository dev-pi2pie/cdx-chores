import { describe, expect, test } from "bun:test";
import { actionFontInspect } from "../src/cli/actions";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";

describe("font CLI inspect output", () => {
  test("prints font inspect text output with multiple faces under one family", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "PingFang TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "PingFang TC\tPingFang TC Regular\tRegular\t/System/Library/Fonts/PingFang.ttc",
          "PingFang TC\tPingFang TC Semibold\tSemibold\t/System/Library/Fonts/PingFang.ttc",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("cdx-chores font inspect");
    expect(stdout.text).toContain("Family: PingFang TC");
    expect(stdout.text).toContain("Discovery: auto");
    expect(stdout.text).toContain("Adapter: linux-fontconfig");
    expect(stdout.text).toContain("Faces:");
    expect(stdout.text.indexOf("- PingFang TC Regular")).toBeLessThan(
      stdout.text.indexOf("- PingFang TC Semibold"),
    );
    expect(stdout.text).toContain("- PingFang TC Regular");
    expect(stdout.text).toContain("  style: normal");
    expect(stdout.text).toContain("  source: system");
    expect(stdout.text).toContain("  format: ttc");
    expect(stdout.text).toContain("- PingFang TC Semibold");
    expect(stdout.text).toContain("  weight: 600");
    expect(stdout.text).toContain("Coverage: not checked.");
    expectNoStderr();
  });

  test("prints font inspect JSON with structured matches", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      json: true,
      family: "Noto Sans TC",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Sans TC\tNoto Sans TC Bold\tBold\t/usr/share/fonts/NotoSansTC-Bold.otf",
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    const payload = JSON.parse(stdout.text) as {
      command: string;
      family: string;
      adapter: string;
      discovery: string;
      warnings: string[];
      matches: Array<{
        family: string;
        fullName: string;
        style: string;
        weight: number;
        source: string;
        format: string;
        path: string;
      }>;
    };
    expect(payload.command).toBe("font inspect");
    expect(payload.family).toBe("Noto Sans TC");
    expect(payload.adapter).toBe("linux-fontconfig");
    expect(payload.discovery).toBe("auto");
    expect(payload.warnings).toEqual([]);
    expect(payload.matches).toHaveLength(1);
    expect(payload.matches[0]).toMatchObject({
      family: "Noto Sans TC",
      fullName: "Noto Sans TC Bold",
      style: "normal",
      weight: 700,
      source: "system",
      format: "otf",
      path: "/usr/share/fonts/NotoSansTC-Bold.otf",
    });
    expectNoStderr();
  });

  test("prints font inspect TTC face indexes in text and JSON output", async () => {
    const textRuntime = createActionTestRuntime({ colorEnabled: false });
    textRuntime.runtime.platform = "linux";

    await actionFontInspect(textRuntime.runtime, {
      family: "Inter",
      runner: async () => ({
        ok: true,
        stdout: [
          "Inter\tInter Bold\tBold\t/Users/user/Fonts/Inter.ttc\t14",
          "Inter\tInter Regular\tRegular\t/Users/user/Fonts/Inter.ttc\t20",
          "Inter\tInter Regular\tRegular\t/Users/user/Fonts/Inter.ttc\t0",
          "Inter\tInter Regular\tRegular\t/Users/user/Fonts/Inter.ttc\t20",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(textRuntime.stdout.text).toContain("- Inter Regular");
    expect(textRuntime.stdout.text.indexOf("  face index: 0")).toBeLessThan(
      textRuntime.stdout.text.indexOf("  face index: 20"),
    );
    expect(textRuntime.stdout.text).toContain("  face index: 20");
    expect(textRuntime.stdout.text).toContain("- Inter Bold");
    expect(textRuntime.stdout.text).toContain("  face index: 14");
    textRuntime.expectNoStderr();

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "linux";
    await actionFontInspect(jsonRuntime.runtime, {
      json: true,
      family: "Inter",
      runner: async () => ({
        ok: true,
        stdout: "Inter\tInter Regular\tRegular\t/Users/user/Fonts/Inter.ttc\t0\n",
        stderr: "",
      }),
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as {
      matches: Array<{ format?: string; faceIndex?: number; path?: string }>;
    };
    expect(payload.matches[0]).toMatchObject({
      format: "ttc",
      faceIndex: 0,
      path: "/Users/user/Fonts/Inter.ttc",
    });
    jsonRuntime.expectNoStderr();
  });

  test("omits unavailable optional font inspect metadata", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Virtual Family",
      runner: async () => ({
        ok: true,
        stdout: "Virtual Family\tVirtual Family Regular\tRegular\t\n",
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("- Virtual Family Regular");
    expect(stdout.text).toContain("  style: normal");
    expect(stdout.text).toContain("  source: system");
    expect(stdout.text).not.toContain("format:");
    expect(stdout.text).not.toContain("face index:");
    expect(stdout.text).not.toContain("path:");
    expectNoStderr();

    const jsonRuntime = createActionTestRuntime();
    jsonRuntime.runtime.platform = "linux";
    await actionFontInspect(jsonRuntime.runtime, {
      json: true,
      family: "Virtual Family",
      runner: async () => ({
        ok: true,
        stdout: "Virtual Family\tVirtual Family Regular\tRegular\t\n",
        stderr: "",
      }),
    });

    const payload = JSON.parse(jsonRuntime.stdout.text) as {
      matches: Array<{ format?: string; faceIndex?: number; path?: string }>;
    };
    expect(payload.matches[0]).not.toHaveProperty("format");
    expect(payload.matches[0]).not.toHaveProperty("faceIndex");
    expect(payload.matches[0]).not.toHaveProperty("path");
    jsonRuntime.expectNoStderr();
  });
});
