import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: top-level smoke", () => {
  test("routes the doctor flow from the root menu", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([{ name: "doctor", options: { json: true } }]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "confirm:Output as JSON?",
    ]);
    expect(result.pathCalls).toHaveLength(0);
  });

  test("shows the broadened data menu copy and includes data stack plus query and extract", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stackPlanWrites).toHaveLength(0);
    expect(result.selectChoicesByMessage["Choose a command"]).toContainEqual({
      name: "data",
      value: "data",
      description: "Preview and convert tabular data",
    });
    expect(
      result.selectChoicesByMessage["Choose a data command"]?.map((choice) => choice.value),
    ).toEqual([
      "data:preview",
      "data:extract",
      "data:stack",
      "data:query",
      "data:parquet-preview",
      "data:convert",
      "back",
      "cancel",
    ]);
  });

  test("routes a markdown flow through file output options", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "md:frontmatter-to-json", "file", "data-only"],
      requiredPathQueue: ["fixtures/doc.md"],
      optionalPathQueue: ["fixtures/doc.frontmatter.json"],
      confirmQueue: [true, false],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "md:frontmatter-to-json",
        options: {
          input: "fixtures/doc.md",
          toStdout: false,
          output: "fixtures/doc.frontmatter.json",
          overwrite: false,
          pretty: true,
          dataOnly: true,
        },
      },
    ]);
  });

  test("routes a rename flow through apply", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:apply"],
      requiredPathQueue: ["plans/rename.csv"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:apply",
        options: {
          csv: "plans/rename.csv",
          autoClean: true,
        },
      },
    ]);
  });

  test("routes a video flow through gif generation", () => {
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

  test("throws when a handler receives an unknown action", () => {
    const result = runInteractiveHarness({ mode: "invalid-data-action" }, { allowFailure: true });

    expect(result.error).toBe("Unhandled interactive action: data:unknown");
  });
});
