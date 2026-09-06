import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-foundations/interactive-harness";

describe("interactive Video routing", () => {
  test("routes quality GIF profile and look options through interactive video", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["video", "video:gif", "quality", "screen", "vibrant"],
      requiredPathQueue: ["fixtures/input.mp4"],
      optionalPathQueue: ["fixtures/output.gif"],
      inputQueue: ["320", "12"],
      confirmQueue: [false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "video:gif",
        options: {
          input: "fixtures/input.mp4",
          output: "fixtures/output.gif",
          mode: "quality",
          gifProfile: "screen",
          gifLook: "vibrant",
          width: 320,
          fps: 12,
          overwrite: false,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a video command",
      "select:GIF mode",
      "select:GIF profile",
      "select:GIF look",
      "input:Width in px (optional)",
      "input:FPS (optional)",
      "confirm:Overwrite if exists?",
    ]);
  });
});
