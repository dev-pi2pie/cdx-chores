import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: video", () => {
  test("routes a video flow through gif generation in compressed mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["video", "video:gif", "compressed"],
      requiredPathQueue: ["fixtures/input.mp4"],
      optionalPathQueue: ["fixtures/output.gif"],
      inputQueue: ["320", "12"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "video:gif",
        options: {
          input: "fixtures/input.mp4",
          output: "fixtures/output.gif",
          mode: "compressed",
          width: 320,
          fps: 12,
          overwrite: true,
        },
      },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a video command",
      "select:GIF mode",
      "input:Width in px (optional)",
      "input:FPS (optional)",
      "confirm:Overwrite if exists?",
    ]);
  });
});
