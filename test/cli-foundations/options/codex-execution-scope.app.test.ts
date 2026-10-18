import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { Command } from "commander";

import { registerCliCommands } from "../../../src/cli/commands";
import { createCapturedRuntime, runCli, withTempFixtureDir } from "../../helpers/cli-test-utils";

const flags = ["--codex-model", "--codex-provider", "--codex-reasoning-effort"];

function harness() {
  const { runtime, stdout, stderr } = createCapturedRuntime();
  const actionEntries: string[] = [];
  const program = new Command()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    })
    .hook("preAction", (_program, actionCommand) => {
      actionEntries.push(actionCommand.name());
      throw new Error("Registration scope checks must not enter action work.");
    });
  registerCliCommands(program, runtime);
  return {
    stdout,
    stderr,
    actionEntries,
    parse: (args: string[]) => program.parseAsync(args, { from: "user" }),
  };
}

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
  )("exposes options on adopted command %j", async ({ command }) => {
    const h = harness();
    await expect(h.parse([...command, "--help"])).rejects.toMatchObject({
      code: "commander.helpDisplayed",
      exitCode: 0,
    });
    expect(h.actionEntries).toEqual([]);
    expect(h.stderr.text).toBe("");
    for (const flag of flags) expect(h.stdout.text).toContain(flag);
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
  )("does not expose options on excluded command %j", async ({ command }) => {
    const h = harness();
    await expect(h.parse([...command, "--help"])).rejects.toMatchObject({
      code: "commander.helpDisplayed",
      exitCode: 0,
    });
    expect(h.actionEntries).toEqual([]);
    expect(h.stderr.text).toBe("");
    for (const flag of flags) expect(h.stdout.text).not.toContain(flag);
  });

  test.each(
    [
      [],
      ["rename", "cleanup", "missing-input"],
      ["data", "query", "missing.csv", "--sql", "select 1"],
      ["data", "extract", "missing.xlsx"],
      ["md", "to-pdf", "--input", "missing.md"],
    ].map((command) => ({ command })),
  )("rejects execution flags before excluded action work %j", async ({ command }) => {
    const h = harness();
    await expect(h.parse([...command, "--codex-model", "synthetic-model"])).rejects.toMatchObject({
      code: "commander.unknownOption",
      exitCode: 1,
    });
    expect(h.actionEntries).toEqual([]);
    expect(h.stdout.text).toBe("");
    expect(h.stderr.text).toContain("unknown option '--codex-model'");
  });
});

describe("Codex execution source CLI boundaries", () => {
  test("root help starts successfully without command-local execution flags", () => {
    const result = runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stderr).toBe("");
    for (const flag of flags) expect(result.stdout).not.toContain(flag);
  });

  test("nested adopted command help exposes execution flags", () => {
    const result = runCli(["md", "pdf-profile", "codex", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    for (const flag of flags) expect(result.stdout).toContain(flag);
  });

  test("root rejects execution flags on stderr with a failing exit", () => {
    const result = runCli(["--codex-model", "synthetic-model"], undefined, {
      CDX_CHORES_CODEX_PATH: "/missing-synthetic-codex",
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unknown option '--codex-model'");
  });

  test("excluded leaf rejects execution flags before input processing or file creation", async () => {
    await withTempFixtureDir("codex-scope-rejection-", async (fixtureDir) => {
      const result = runCli(
        ["md", "to-pdf", "--input", "missing.md", "--codex-model", "synthetic-model"],
        fixtureDir,
        { CDX_CHORES_CODEX_PATH: "/missing-synthetic-codex" },
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("unknown option '--codex-model'");
      expect(await readdir(fixtureDir)).toEqual([]);
    });
  });
});
