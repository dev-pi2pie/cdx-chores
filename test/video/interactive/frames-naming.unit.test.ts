import { describe, expect, test } from "bun:test";

import {
  effectiveFrameSerial,
  validateFrameTemplate,
  type FrameNamingMode,
} from "../../../src/cli/interactive/video-frames/naming";
import {
  resolveTemplateCompletionMatch,
  type TemplateCompletionKind,
} from "../../../src/cli/prompts/text-template-candidates";

describe("video frame naming language", () => {
  test("single, set, and sequence templates admit only their mode's tokens", () => {
    expect(validateFrameTemplate("single", "{stem}-{selection}-{frame}")).toBe(true);
    expect(validateFrameTemplate("single", "chosen-image")).toBe(true);
    expect(validateFrameTemplate("set", "{stem}-{selection}-{frame}")).toBe(true);
    expect(validateFrameTemplate("sequence", "{stem}-{serial}-{frame}")).toBe(true);
    expect(validateFrameTemplate("single", "{stem}-{serial}")).not.toBe(true);
    expect(validateFrameTemplate("set", "{selection}-{serial}")).not.toBe(true);
    expect(validateFrameTemplate("sequence", "{selection}-{serial}")).not.toBe(true);
    expect(validateFrameTemplate("set", "{stem}-{frame}")).not.toBe(true);
  });

  test("rename tokens and parameters on source-identity tokens are unavailable", () => {
    for (const mode of ["single", "set", "sequence"] as const) {
      const required = mode === "set" ? "-{selection}" : mode === "sequence" ? "-{serial}" : "";
      for (const token of [
        "uid",
        "timestamp",
        "prefix",
        "stem_start_2",
        "selection_###",
        "frame_###",
      ]) {
        expect(validateFrameTemplate(mode, `{${token}}${required}`)).not.toBe(true);
      }
    }
  });

  test("sequence templates require exactly one serial even when frame numbers appear", () => {
    expect(validateFrameTemplate("sequence", "{stem}-{frame}")).not.toBe(true);
    expect(validateFrameTemplate("sequence", "{serial}-{serial_start_3}")).not.toBe(true);
    expect(validateFrameTemplate("sequence", "{frame}-{serial_####}")).toBe(true);
  });

  test("embedded start and width parameters are order independent and allow start zero", () => {
    for (const [token, start, width] of [
      ["serial", 1, 6],
      ["serial_####", 1, 4],
      ["serial_start_3", 3, 6],
      ["serial_####_start_3", 3, 4],
      ["serial_start_3_####", 3, 4],
      ["serial_start_0", 0, 6],
    ] as const) {
      const template = `{stem}-{${token}}`;
      expect(validateFrameTemplate("sequence", template)).toBe(true);
      expect(effectiveFrameSerial({ template })).toEqual({ start, width });
    }
  });

  test("explicit serial settings independently override embedded parameters before defaults", () => {
    const template = "{stem}-{serial_start_3_####}";
    expect(effectiveFrameSerial({ template, serialStart: 0 })).toEqual({ start: 0, width: 4 });
    expect(effectiveFrameSerial({ template, serialWidth: 2 })).toEqual({ start: 3, width: 2 });
    expect(effectiveFrameSerial({ template, serialStart: 0, serialWidth: 8 })).toEqual({
      start: 0,
      width: 8,
    });
    expect(effectiveFrameSerial({ template: "{stem}-{serial}", serialStart: 9 })).toEqual({
      start: 9,
      width: 6,
    });
  });

  test("rejects duplicate, missing, malformed, and unsafe serial parameters", () => {
    for (const token of [
      "serial_start_1_start_2",
      "serial_##_###",
      "serial_start",
      "serial_start_-1",
      "serial_start_1.5",
      "serial___",
      "serial_foo",
      "serial_start_9007199254740992",
      "serial_" + "#".repeat(251),
    ])
      expect(validateFrameTemplate("sequence", `{stem}-{${token}}`)).not.toBe(true);
  });

  test("templates are basename languages with balanced placeholders", () => {
    for (const mode of ["single", "set", "sequence"] as const) {
      const required = mode === "set" ? "{selection}" : mode === "sequence" ? "{serial}" : "{stem}";
      for (const value of [
        "",
        " ",
        "dir/" + required,
        "dir\\" + required,
        required + "\n",
        required + "\0",
        "{{stem}}" + required,
        "{}" + required,
        "{stem" + required,
      ]) {
        expect(validateFrameTemplate(mode, value)).not.toBe(true);
      }
    }
  });
});

describe("video filename template completion", () => {
  const modes: readonly [TemplateCompletionKind, FrameNamingMode, string[]][] = [
    ["video-frame", "single", ["{stem}", "{selection}", "{frame}"]],
    ["video-frame-set", "set", ["{stem}", "{selection}", "{frame}"]],
    ["video-sequence", "sequence", ["{stem}", "{serial}", "{frame}"]],
  ];

  test("each completion registry exposes exactly the tokens permitted by that field", () => {
    for (const [kind, , allowed] of modes) {
      const match = resolveTemplateCompletionMatch("clip-{", kind);
      expect(new Set(match?.candidates)).toEqual(new Set(allowed));
      expect(match?.fragmentStart).toBe(5);
      expect(match?.fragment).toBe("{");
      for (const prefix of ["{uid", "{timestamp", "{prefix", "{date"]) {
        expect(resolveTemplateCompletionMatch(prefix, kind)).toBeUndefined();
      }
    }
  });

  test("prefix matching excludes cross-mode tokens and preserves the literal basename prefix", () => {
    expect(resolveTemplateCompletionMatch("clip-{fr", "video-frame")?.candidates).toEqual([
      "{frame}",
    ]);
    expect(resolveTemplateCompletionMatch("clip-{se", "video-frame-set")?.candidates).toEqual([
      "{selection}",
    ]);
    expect(resolveTemplateCompletionMatch("clip-{ser", "video-sequence")?.candidates).toEqual([
      "{serial}",
    ]);
    expect(resolveTemplateCompletionMatch("{serial", "video-frame")).toBeUndefined();
    expect(resolveTemplateCompletionMatch("{selection", "video-sequence")).toBeUndefined();
    expect(resolveTemplateCompletionMatch("clip-{stem}", "video-frame")).toBeUndefined();
  });
});
