import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { pathExists } from "../markdown-pdf/support/path-fixtures";

describe("cli command: md pdf-project codex", () => {
  test("documents the project Codex helper options", () => {
    const result = runCli(["md", "pdf-project", "codex", "--help"]);
    const normalizedStdout = result.stdout.replace(/\s+/g, " ");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: cdx-chores md pdf-project codex [options] [input]");
    expect(normalizedStdout).toContain(
      "Draft a coordinated Markdown PDF profile and template project bundle",
    );
    expect(result.stdout).toContain("input");
    expect(normalizedStdout).toContain("Markdown sample for shared project signals");
    expect(result.stdout).toContain("-i, --input <path>");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--font-hint <text>");
    expect(result.stdout).toContain("--base-profile <path>");
    expect(result.stdout).toContain("--cover-image <path>");
    expect(result.stdout).toContain("-o, --output <directory>");
    expect(result.stdout).toContain("--dry-run");
    expect(result.stdout).toContain("--keep-codex-report");
    expect(result.stdout).toContain("--codex-report-output <path>");
    expect(result.stdout).toContain("--overwrite");
    expect(result.stdout).not.toContain("--preset <value>");
    expect(result.stdout).not.toContain("--page-size <value>");
    expect(result.stdout).not.toContain("--orientation <value>");
    expect(result.stdout).not.toContain("--margin <length>");
    expect(result.stdout).not.toContain("--margin-x <length>");
    expect(result.stdout).not.toContain("--margin-y <length>");
    expect(result.stdout).not.toContain("--margin-top <length>");
    expect(result.stdout).not.toContain("--margin-right <length>");
    expect(result.stdout).not.toContain("--margin-bottom <length>");
    expect(result.stdout).not.toContain("--margin-left <length>");
    expect(result.stdout).not.toContain("--toc");
    expect(result.stdout).not.toContain("--toc-depth <n>");
    expect(result.stdout).not.toContain("--toc-page-break <value>");
    expect(result.stderr).toBe("");
  });

  test("rejects recipe flags from the project Codex command surface", () => {
    for (const flag of ["--preset", "--margin", "--toc"] as const) {
      const result = runCli(["md", "pdf-project", "codex", flag, "report"]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`unknown option '${flag}'`);
    }
  });

  test("rejects conflicting positional and explicit project inputs from the command layer", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-input-conflict", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "one.md");
      const secondInputPath = join(fixtureDir, "two.md");
      await writeFile(firstInputPath, "# One\n", "utf8");
      await writeFile(secondInputPath, "# Two\n", "utf8");

      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        toRepoRelativePath(firstInputPath),
        "--input",
        toRepoRelativePath(secondInputPath),
        "--output",
        toRepoRelativePath(join(fixtureDir, "pdf-project")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Positional input and --input");
    });
  });

  test("rejects invalid project report paths before later orchestration work", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-report-path", async (fixtureDir) => {
      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        "--codex-report-output",
        toRepoRelativePath(join(fixtureDir, "project-report.txt")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("project Codex report path must end with .json");
    });
  });

  test("writes deterministic project bundles from the command layer", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-write", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "pdf-project");
      await writeFile(
        baseProfilePath,
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
        "utf8",
      );

      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        "--base-profile",
        toRepoRelativePath(baseProfilePath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Project signal mode: deterministic");
      expect(result.stdout).toContain("Final decision mode: deterministic");
      expect(result.stdout).toContain("Profile: profile.yml");
      expect(result.stdout).toContain("Template HTML: template.html");
      expect(result.stdout).toContain("Stylesheet: style.css");
      expect(result.stderr).toContain("Wrote Markdown PDF project bundle:");
      expect(await readFile(join(outputPath, "profile.yml"), "utf8")).toContain("md-pdf-profile-");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
    });
  });

  test("writes dry-run project reports from the command layer", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cli-dry-run-report", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "pdf-project");
      await writeFile(
        baseProfilePath,
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
        "utf8",
      );

      const result = runCli([
        "md",
        "pdf-project",
        "codex",
        "--base-profile",
        toRepoRelativePath(baseProfilePath),
        "--output",
        toRepoRelativePath(outputPath),
        "--dry-run",
        "--keep-codex-report",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Project signal mode: deterministic");
      expect(result.stdout).toContain("Final decision mode: deterministic");
      expect(result.stdout).toContain("Dry run only. No project bundle files were written.");
      expect(result.stdout).toContain("Codex report:");
      expect(result.stdout).toContain(
        toRepoRelativePath(join(outputPath, "project.codex-report.json")),
      );
      expect(result.stdout).toContain("Follow-up render:");
      expect(result.stdout).toContain(`'--bundle' '${toRepoRelativePath(outputPath)}'`);
      expect(result.stdout).toContain("<input.md>");
      expect(result.stdout).toContain("<output.pdf>");
      expect(result.stderr).toBe("");
      expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "style.css"))).toBe(false);

      const reportText = await readFile(join(outputPath, "project.codex-report.json"), "utf8");
      const report = JSON.parse(reportText) as {
        advisoryOnly: boolean;
        artifactType: string;
        files: Array<{ bundlePath?: string; role: string }>;
        followUpRenderCommand: { args: string[]; display: string };
        project: { decisionMode: string; signalMode: string };
      };
      expect(report).toMatchObject({
        advisoryOnly: true,
        artifactType: "markdown-pdf-codex-project-report",
        project: {
          decisionMode: "deterministic",
          signalMode: "deterministic",
        },
      });
      expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
      expect(report.files.find((file) => file.role === "project-report")).toMatchObject({
        bundlePath: "project.codex-report.json",
      });
      expect(report.followUpRenderCommand.display).toContain("<input.md>");
      expect(report.followUpRenderCommand.display).toContain("<output.pdf>");
      expect(report.followUpRenderCommand.args).toContain("<input.md>");
      expect(report.followUpRenderCommand.args).toContain("<output.pdf>");
    });
  });

  test("writes dry-run reports before no-usable project failures from the command layer", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-cli-dry-run-no-usable-report",
      async (fixtureDir) => {
        const baseProfilePath = join(fixtureDir, "base.yml");
        const reportPath = join(fixtureDir, "project-report.json");
        const outputPath = join(fixtureDir, "pdf-project");
        await writeFile(
          baseProfilePath,
          [
            "profile:",
            "  id: md-pdf-profile-20260101T000000Z-ba5e0001",
            "  source: deterministic",
            "  createdAt: 2026-01-01T00:00:00Z",
            "page:",
            "  size: Letter",
            "cover:",
            "  enabled: true",
            "  style: report",
            "  fields:",
            "    title: Project Cover",
            "",
          ].join("\n"),
          "utf8",
        );

        const result = runCli([
          "md",
          "pdf-project",
          "codex",
          "--base-profile",
          toRepoRelativePath(baseProfilePath),
          "--output",
          toRepoRelativePath(outputPath),
          "--dry-run",
          "--codex-report-output",
          toRepoRelativePath(reportPath),
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("Project signal mode: deterministic");
        expect(result.stdout).toContain("Final decision mode: no-usable-project");
        expect(result.stdout).toContain("Dry run only. No project bundle files were written.");
        expect(result.stdout).toContain("Codex report:");
        expect(result.stdout).toContain(toRepoRelativePath(reportPath));
        expect(result.stdout).not.toContain(fixtureDir);
        expect(result.stderr).toContain(
          "requires exactly one live .pdf-cover element when the Profile cover is enabled",
        );
        expect(await pathExists(join(outputPath, "profile.yml"))).toBe(false);
        expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
        expect(await pathExists(join(outputPath, "style.css"))).toBe(false);

        expect(await pathExists(join(outputPath, "project.codex-report.json"))).toBe(false);

        const reportText = await readFile(reportPath, "utf8");
        const report = JSON.parse(reportText) as {
          files: Array<{ path?: string; role: string }>;
          followUpRenderCommand?: unknown;
          input: { baseProfile: { basename: string } };
          project: { decisionMode: string; fallbackReason?: string };
        };
        expect(report.project).toMatchObject({
          decisionMode: "no-usable-project",
          fallbackReason:
            "The selected managed Markdown PDF template requires exactly one live .pdf-cover element when the Profile cover is enabled (found 0).",
        });
        expect(report.input.baseProfile.basename).toBe("base.yml");
        expect(report.files.map((file) => file.role)).toEqual(["project-report"]);
        expect(report.files[0]?.path).toBe(toRepoRelativePath(reportPath));
        expect(report.files[0]?.path).not.toContain(fixtureDir);
        expect(report.followUpRenderCommand).toBeUndefined();
      },
    );
  });
});
