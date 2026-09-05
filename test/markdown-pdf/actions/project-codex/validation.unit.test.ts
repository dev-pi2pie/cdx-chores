import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { createMdPdfProjectCodexRenderCommand } from "../../../../src/cli/markdown-pdf/project-codex";
import type { MarkdownPdfProjectCodexOutputPlan } from "../../../../src/cli/markdown-pdf/project-codex/types";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";

function plannedOutputForRenderCommand(outputDirectory: string): MarkdownPdfProjectCodexOutputPlan {
  return {
    assets: [],
    generatedOutputDirectory: false,
    identity: {
      createdAt: "2026-07-04T08:00:00Z",
      outputDirectory,
      profileId: "md-pdf-profile-20260704T080000Z-abc12345",
      projectBundleId: "md-pdf-project-20260704T080000Z-abc12345",
      templateBundleId: "md-pdf-template-20260704T080000Z-abc12345",
    },
    outputDirectory,
    profile: { bundlePath: "profile.yml", path: join(outputDirectory, "profile.yml") },
    templateHtml: { bundlePath: "template.html", path: join(outputDirectory, "template.html") },
    styleCss: { bundlePath: "style.css", path: join(outputDirectory, "style.css") },
  };
}

describe("cli action modules: md pdf-project codex validation", () => {
  test("sanitizes render command paths outside cwd and keeps placeholders replayable", () => {
    const { runtime } = createActionTestRuntime({ cwd: "/repo" });
    const command = createMdPdfProjectCodexRenderCommand({
      outputPlan: plannedOutputForRenderCommand("/external/project"),
      runtime,
      state: {
        inputPath: "/secret/report.md",
        fontHints: [],
        dryRun: false,
        keepCodexReport: false,
        overwrite: false,
      },
    });

    expect(command.args).toEqual([
      "md",
      "to-pdf",
      "--input",
      "<input.md>",
      "--bundle",
      "<project-bundle>",
      "--output",
      "<output.pdf>",
    ]);
    expect(command.display).not.toContain("/secret");
    expect(command.display).not.toContain("/external");
  });

  test("quotes render command paths with spaces and single quotes", () => {
    const { runtime } = createActionTestRuntime({ cwd: "/repo" });
    const command = createMdPdfProjectCodexRenderCommand({
      outputPlan: plannedOutputForRenderCommand("/repo/project dir"),
      runtime,
      state: {
        inputPath: "/repo/report's file.md",
        fontHints: [],
        dryRun: false,
        keepCodexReport: false,
        overwrite: false,
      },
    });

    expect(command.args).toContain("report's file.md");
    expect(command.args).toContain("project dir");
    expect(command.display).toContain("'report'\\''s file.md'");
    expect(command.display).toContain("'project dir'");
    expect(command.display).not.toContain("--profile");
    expect(command.display).not.toContain("--template");
    expect(command.display).not.toContain("--css");
  });

  test("normalizes Windows-style render command paths relative to Windows cwd", () => {
    const { runtime } = createActionTestRuntime({ cwd: "C:\\work\\repo" });
    const command = createMdPdfProjectCodexRenderCommand({
      outputPlan: plannedOutputForRenderCommand("C:\\work\\repo\\project"),
      runtime,
      state: {
        inputPath: "C:\\work\\repo\\draft.md",
        fontHints: [],
        dryRun: false,
        keepCodexReport: false,
        overwrite: false,
      },
    });

    expect(command.args).toContain("draft.md");
    expect(command.args).toContain("project");
    expect(command.display).not.toContain("C:\\work");
  });
});
