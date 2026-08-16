import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "./cli-interactive-routing.helpers";

describe("interactive mode routing: top-level smoke", () => {
  test("routes the doctor Summary choice and records its explicit default", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor", "summary"],
    });

    expect(result.actionCalls).toEqual([
      { name: "doctor", options: { details: false, json: false } },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose doctor output",
    ]);
    expect(result.selectChoicesByMessage["Choose doctor output"]).toEqual([
      {
        name: "Summary",
        value: "summary",
        description: "Workflow readiness and recommended actions",
      },
      {
        name: "Detailed evidence",
        value: "details",
        description: "Versions, checks, and capability evidence",
      },
      { name: "JSON", value: "json", description: "Machine-readable evidence" },
    ]);
    expect(result.selectDefaultsByMessage["Choose doctor output"]).toEqual(["summary"]);
    expect(result.pathCalls).toHaveLength(0);
  });

  test("routes the doctor Detailed evidence choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor", "details"],
    });

    expect(result.actionCalls).toEqual([
      { name: "doctor", options: { details: true, json: false } },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose doctor output",
    ]);
    expect(result.pathCalls).toHaveLength(0);
  });

  test("routes the doctor JSON choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["doctor", "json"],
    });

    expect(result.actionCalls).toEqual([
      { name: "doctor", options: { details: false, json: true } },
    ]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose doctor output",
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

  test("shows the markdown pdf submenu entries before the existing markdown routes", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.selectChoicesByMessage["Choose a command"]).toContainEqual({
      name: "md",
      value: "md",
      description: "Markdown utilities",
    });
    expect(
      result.selectChoicesByMessage["Choose a markdown command"]?.map((choice) => choice.value),
    ).toEqual([
      "md:to-pdf",
      "md:pdf-recipes",
      "md:to-docx",
      "md:frontmatter-to-json",
      "back",
      "cancel",
    ]);
    expect(
      result.selectChoicesByMessage["Choose a markdown command"]?.map(
        (choice) => choice.description ?? "",
      ),
    ).toEqual([
      "Create a PDF",
      "Prepare reusable PDF recipes",
      "",
      "",
      "Return to the main command menu",
      "Exit interactive mode",
    ]);
  });

  test("returns from the markdown submenu to the root menu", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "back", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a markdown command",
      "select:Choose a command",
    ]);
  });

  test("routes a built-in markdown pdf render through the prepared service", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: ["md", "md:to-pdf", "built-in", "inherit", "inherit", "default"],
      requiredPathQueue: ["fixtures/doc.md"],
      confirmQueue: [false, true],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("returns from markdown pdf source selection to the markdown submenu", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: ["md", "md:to-pdf", "back", "cancel"],
      requiredPathQueue: ["fixtures/doc.md"],
    });

    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a markdown command",
      "select:Choose a recipe for this PDF",
      "select:Choose a markdown command",
    ]);
  });

  test("routes the markdown pdf recipes branch into deterministic artifact selection", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: ["md", "md:pdf-recipes", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.pathCalls).toHaveLength(0);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a markdown command",
      "select:What would you like to create?",
    ]);
    expect(result.error).toBeUndefined();
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

  test("preserves the existing markdown to-docx route after the module move", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "md:to-docx"],
      requiredPathQueue: ["fixtures/doc.md"],
      optionalPathQueue: ["fixtures/doc.docx"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "md:to-docx",
        options: {
          input: "fixtures/doc.md",
          output: "fixtures/doc.docx",
          overwrite: true,
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
