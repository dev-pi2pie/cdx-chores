import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { actionRenameApply, actionRenameCleanup } from "../../../src/cli/actions";
import type { RenameBatchOptions, RenameFileOptions } from "../../../src/cli/actions/rename";
import { registerRenameCommands } from "../../../src/cli/commands/rename";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

function harness() {
  const { runtime } = createCapturedRuntime();
  const calls: Array<RenameFileOptions | RenameBatchOptions> = [];
  const program = new Command().exitOverride().configureOutput({ writeOut() {}, writeErr() {} });
  registerRenameCommands(program, runtime, {
    actionRenameApply,
    actionRenameCleanup,
    actionRenameFile: async (_runtime, options) => {
      calls.push(options);
      return { changed: false, filePath: options.path, directoryPath: "." };
    },
    actionRenameBatch: async (_runtime, options) => {
      calls.push(options);
      return { changedCount: 0, totalCount: 0, directoryPath: options.directory };
    },
  });
  return { program, calls, parse: (args: string[]) => program.parseAsync(args, { from: "user" }) };
}

describe("rename execution options", () => {
  const commands = [
    ["rename", "file", "sample.md"],
    ["rename", "batch", "."],
    ["batch-rename", "."],
  ];
  test.each(commands)("forwards execution settings for %j", async (...command) => {
    const h = harness();
    await h.parse([
      ...command,
      "--codex-model",
      "Custom/Model",
      "--codex-provider",
      "company",
      "--codex-reasoning-effort",
      "medium",
      "--codex-timeout",
      "60s",
    ]);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      codexExecution: { model: "Custom/Model", provider: "company", reasoningEffort: "medium" },
      codexTimeoutMs: 60_000,
      codex: false,
      codexImages: false,
      codexDocs: false,
    });
  });
  test.each(commands)("uses low without model/provider overrides for %j", async (...command) => {
    const h = harness();
    await h.parse(command);
    expect(h.calls[0]!.codexExecution).toEqual({ reasoningEffort: "low" });
  });
  test.each(commands)("rejects duplicates before action for %j", async (...command) => {
    const h = harness();
    await expect(
      h.parse([...command, "--codex-model", "one", "--codex-model", "two"]),
    ).rejects.toThrow("may only be specified once");
    expect(h.calls).toEqual([]);
  });
  test("registers all options on adopted leaves only", () => {
    const { program } = harness();
    const rename = program.commands.find((c) => c.name() === "rename")!;
    const leaves = [
      rename.commands.find((c) => c.name() === "file")!,
      rename.commands.find((c) => c.name() === "batch")!,
      program.commands.find((c) => c.name() === "batch-rename")!,
    ];
    for (const command of leaves) {
      for (const flag of ["--codex-model", "--codex-provider", "--codex-reasoning-effort"]) {
        expect(command.helpInformation()).toContain(flag);
      }
    }
    expect(program.helpInformation()).not.toContain("--codex-model");
    expect(rename.helpInformation()).not.toContain("--codex-model");
    expect(rename.commands.find((c) => c.name() === "cleanup")!.helpInformation()).not.toContain(
      "--codex-model",
    );
  });
  test("rejects execution flags on cleanup", async () => {
    const h = harness();
    await expect(h.parse(["rename", "cleanup", ".", "--codex-model", "custom"])).rejects.toThrow(
      "unknown option",
    );
    expect(h.calls).toEqual([]);
  });
});
