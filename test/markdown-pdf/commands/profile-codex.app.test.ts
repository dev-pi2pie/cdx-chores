import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runCli, toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";
import { createProfileCodexStub } from "./fixtures";
import { pathExists } from "../support/path-fixtures";

describe("cli command: md pdf-profile codex", () => {
  test("documents the direct Codex profile helper options", () => {
    const result = runCli(["md", "pdf-profile", "codex", "--help"]);
    const normalizedStdout = result.stdout.replace(/\s+/g, " ");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: cdx-chores md pdf-profile codex [options] [input]");
    expect(normalizedStdout).toContain(
      "Draft a reusable Markdown PDF profile from sample signals, hints, or fallback defaults",
    );
    expect(result.stdout).toContain("input");
    expect(normalizedStdout).toContain("Markdown sample for document-informed profile signals");
    expect(result.stdout).toContain("-i, --input <path>");
    expect(normalizedStdout).toContain("Same as the input argument; useful in scripts");
    expect(result.stdout).toContain("--intent <text>");
    expect(result.stdout).toContain("--font-hint <text>");
    expect(normalizedStdout).toContain(
      "Repeatable font preference hint for the same Codex request",
    );
    expect(result.stdout).toContain("--base-profile <path>");
    expect(result.stdout).toContain("--keep-codex-report");
    expect(result.stderr).toBe("");
  });

  test("allows no-signal deterministic profile creation from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-basic", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "profile.yml");

      const result = runCli([
        "md",
        "pdf-profile",
        "codex",
        "--output",
        toRepoRelativePath(outputPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Signal mode: basic-default");
      expect(result.stdout).toContain("Decision: deterministic");
      expect(result.stderr).toContain("Wrote Markdown PDF profile:");
      expect(await readFile(outputPath, "utf8")).toContain("source: deterministic");
    });
  });

  test("treats blank-only font hints as no signal from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-blank-font-hint", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "profile.yml");

      const result = runCli([
        "md",
        "pdf-profile",
        "codex",
        "--font-hint",
        "   ",
        "--output",
        toRepoRelativePath(outputPath),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Signal mode: basic-default");
      expect(result.stdout).toContain("Decision: deterministic");
      expect(result.stderr).toContain("Wrote Markdown PDF profile:");
      expect(await readFile(outputPath, "utf8")).toContain("source: deterministic");
    });
  });

  test("writes no-usable failure reports from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-no-usable-report", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "profile.codex-report.json");
      const codexStubPath = await createProfileCodexStub(fixtureDir);

      const result = runCli(
        [
          "md",
          "pdf-profile",
          "codex",
          "--intent",
          "unsupported profile direction",
          "--output",
          toRepoRelativePath(outputPath),
          "--codex-report-output",
          toRepoRelativePath(reportPath),
        ],
        undefined,
        {
          CDX_CHORES_CODEX_PATH: codexStubPath,
          CODEX_API_KEY: "",
          OPENAI_API_KEY: "",
        },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Requesting Codex Markdown PDF profile recommendation");
      expect(result.stderr).toContain("Wrote Codex report:");
      expect(result.stderr).toContain("Codex did not find a usable Markdown PDF profile.");
      expect(await pathExists(outputPath)).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifact: { type: string };
        result: {
          failure?: { kind: string; message: string };
          status: string;
          unmatchedDirections: string[];
        };
      };
      expect(report.artifact.type).toBe("markdown-pdf-codex-profile-report");
      expect(report.result).toMatchObject({
        failure: {
          kind: "no-usable-profile",
          message: "Codex did not find a usable Markdown PDF profile.",
        },
        status: "failed",
        unmatchedDirections: [],
      });
    });
  });

  test("rejects conflicting positional and explicit Codex profile inputs from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-cli-input-conflict", async (fixtureDir) => {
      const firstInputPath = join(fixtureDir, "one.md");
      const secondInputPath = join(fixtureDir, "two.md");
      await writeFile(firstInputPath, "# One\n", "utf8");
      await writeFile(secondInputPath, "# Two\n", "utf8");

      const result = runCli([
        "md",
        "pdf-profile",
        "codex",
        toRepoRelativePath(firstInputPath),
        "--input",
        toRepoRelativePath(secondInputPath),
        "--output",
        toRepoRelativePath(join(fixtureDir, "profile.yml")),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Positional input and --input");
    });
  });
});
