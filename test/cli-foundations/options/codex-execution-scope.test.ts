import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

const flags = ["--codex-model", "--codex-provider", "--codex-reasoning-effort"];

describe("Codex execution command scope", () => {
  test.each(
    [
      ["rename", "file"],
      ["rename", "batch"],
      ["batch-rename"],
      ["interactive"],
      ["data", "query", "codex"],
      ["data", "stack"],
      ["md", "pdf-profile", "codex"],
      ["md", "pdf-template", "codex"],
      ["md", "pdf-project", "codex"],
    ].map((command) => ({ command })),
  )("exposes options on adopted command %j", ({ command }) => {
    const result = runCli([...command, "--help"]);
    expect(result.exitCode).toBe(0);
    for (const flag of flags) expect(result.stdout).toContain(flag);
  });

  test.each(
    [
      [],
      ["rename"],
      ["rename", "cleanup"],
      ["data"],
      ["data", "query"],
      ["data", "extract"],
      ["md"],
      ["md", "to-pdf"],
      ["md", "pdf-profile"],
      ["md", "pdf-template"],
      ["md", "pdf-project"],
    ].map((command) => ({ command })),
  )("does not expose options on excluded command %j", ({ command }) => {
    const result = runCli([...command, "--help"]);
    expect(result.exitCode).toBe(0);
    for (const flag of flags) expect(result.stdout).not.toContain(flag);
  });

  test.each(
    [
      [],
      ["rename", "cleanup", "missing-input"],
      ["data", "query", "missing.csv", "--sql", "select 1"],
      ["data", "extract", "missing.xlsx"],
      ["md", "to-pdf", "--input", "missing.md"],
    ].map((command) => ({ command })),
  )("rejects execution flags before excluded action work %j", ({ command }) => {
    const result = runCli([...command, "--codex-model", "synthetic-model"], undefined, {
      CDX_CHORES_CODEX_PATH: "/missing-synthetic-codex",
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("unknown option '--codex-model'");
  });
});
