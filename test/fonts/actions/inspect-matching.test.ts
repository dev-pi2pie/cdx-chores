import { describe, expect, test } from "bun:test";
import { actionFontInspect } from "../../../src/cli/actions";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";

describe("font CLI inspect matching", () => {
  test("matches font inspect by full name and prints family groups", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "  noto   sans tc regular  ",
      runner: async () => ({
        ok: true,
        stdout: [
          "Noto Sans TC\tNoto Sans TC Regular\tRegular\t/usr/share/fonts/NotoSansTC-Regular.otf",
          "Source Serif 4\tSource Serif 4 Regular\tRegular\t/usr/share/fonts/SourceSerif4-Regular.otf",
          "",
        ].join("\n"),
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Family: noto   sans tc regular");
    expect(stdout.text).toContain("Family group: Noto Sans TC");
    expect(stdout.text).toContain("- Noto Sans TC Regular");
    expectNoStderr();
  });

  test("matches aliases and alternate full names without changing family identity", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
      colorEnabled: false,
    });
    runtime.platform = "linux";

    await actionFontInspect(runtime, {
      family: "Noto Sans JP",
      runner: async () => ({
        ok: true,
        stdout:
          "Noto Sans CJK JP,Noto Sans JP\tNoto Sans CJK JP Regular,Noto Sans JP Regular\tRegular\t/usr/share/fonts/NotoSansCJK-Regular.otf\n",
        stderr: "",
      }),
    });

    expect(stdout.text).toContain("Family group: Noto Sans CJK JP");
    expect(stdout.text).toContain("- Noto Sans CJK JP Regular");
    expectNoStderr();

    const fullNameRuntime = createActionTestRuntime({ colorEnabled: false });
    fullNameRuntime.runtime.platform = "linux";
    await actionFontInspect(fullNameRuntime.runtime, {
      family: "Noto Sans JP Regular",
      runner: async () => ({
        ok: true,
        stdout:
          "Noto Sans CJK JP,Noto Sans JP\tNoto Sans CJK JP Regular,Noto Sans JP Regular\tRegular\t/usr/share/fonts/NotoSansCJK-Regular.otf\n",
        stderr: "",
      }),
    });
    expect(fullNameRuntime.stdout.text).toContain("Family group: Noto Sans CJK JP");
    fullNameRuntime.expectNoStderr();
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

  test("prints zero-face text for an unmatched family", async () => {
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
