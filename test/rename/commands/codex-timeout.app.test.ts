import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import {
  actionRenameApply,
  actionRenameBatch,
  actionRenameCleanup,
  actionRenameFile,
} from "../../../src/cli/actions";
import type { RenameBatchOptions, RenameFileOptions } from "../../../src/cli/actions/rename";
import { registerRenameCommands } from "../../../src/cli/commands/rename";
import { createCapturedRuntime, runCli } from "../../helpers/cli-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");
const ANSI_START = `${String.fromCharCode(27)}[`;

interface RenameCommandHarness {
  batchCalls: RenameBatchOptions[];
  fileCalls: RenameFileOptions[];
  parse: (args: string[]) => Promise<unknown>;
  program: Command;
  stderr: { text: string };
  stdout: { text: string };
}

function createRenameCommandHarness(
  options: { colorEnabled?: boolean; stderrIsTTY?: boolean } = {},
): RenameCommandHarness {
  const { runtime, stdout, stderr } = createCapturedRuntime({
    colorEnabled: options.colorEnabled ?? false,
  });
  (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = options.stderrIsTTY;
  const batchCalls: RenameBatchOptions[] = [];
  const fileCalls: RenameFileOptions[] = [];
  const actionRenameBatchImpl: typeof actionRenameBatch = async (_runtime, options) => {
    batchCalls.push(options);
    return {
      changedCount: 0,
      totalCount: 0,
      directoryPath: options.directory,
    };
  };
  const actionRenameFileImpl: typeof actionRenameFile = async (_runtime, options) => {
    fileCalls.push(options);
    return {
      changed: false,
      filePath: options.path,
      directoryPath: ".",
    };
  };
  const program = new Command();
  program
    .name("cdx-chores")
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    });
  registerRenameCommands(program, runtime, {
    actionRenameApply,
    actionRenameBatch: actionRenameBatchImpl,
    actionRenameCleanup,
    actionRenameFile: actionRenameFileImpl,
  });

  return {
    batchCalls,
    fileCalls,
    parse: (args) => program.parseAsync(["node", "test", ...args]),
    program,
    stderr,
    stdout,
  };
}

function findCommand(program: Command, path: string[]): Command {
  return path.reduce((parent, name) => {
    const command = parent.commands.find((candidate) => candidate.name() === name);
    if (!command) {
      throw new Error(`Expected command ${path.join(" ")}`);
    }
    return command;
  }, program);
}

async function expectParseFailure(harness: RenameCommandHarness, args: string[]): Promise<void> {
  try {
    await harness.parse(args);
  } catch (error) {
    expect(error).toHaveProperty("exitCode", 1);
    return;
  }

  throw new Error("Expected Commander parsing to fail");
}

function expectNoActionCalls(harness: RenameCommandHarness): void {
  expect(harness.fileCalls).toEqual([]);
  expect(harness.batchCalls).toEqual([]);
}

describe("rename Codex timeout command routing", () => {
  test.each([
    {
      label: "rename file",
      args: ["rename", "file", "sample.md"],
      expectedPath: "sample.md",
      callKind: "file",
    },
    {
      label: "rename batch",
      args: ["rename", "batch", "./files"],
      expectedPath: "./files",
      callKind: "batch",
    },
    {
      label: "batch-rename",
      args: ["batch-rename", "./files"],
      expectedPath: "./files",
      callKind: "batch",
    },
  ])("maps shared and scoped precedence for $label", async (scenario) => {
    const harness = createRenameCommandHarness();

    await harness.parse([
      ...scenario.args,
      "--codex-timeout",
      "45s",
      "--codex-images-timeout",
      "2m",
    ]);

    const calls = scenario.callKind === "file" ? harness.fileCalls : harness.batchCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      codex: false,
      codexTimeoutMs: 45_000,
      codexImages: false,
      codexImagesTimeoutMs: 120_000,
      codexDocs: false,
    });
    expect(calls[0]?.codexDocsTimeoutMs).toBeUndefined();
    expect(
      scenario.callKind === "file"
        ? (calls[0] as RenameFileOptions).path
        : (calls[0] as RenameBatchOptions).directory,
    ).toBe(scenario.expectedPath);
    expect(harness.stderr.text).toBe("");
  });

  test("leaves the unconfigured analyzer timeout undefined for one scoped option", async () => {
    const harness = createRenameCommandHarness();

    await harness.parse(["rename", "file", "sample.md", "--codex-docs-timeout", "90s"]);

    expect(harness.fileCalls[0]?.codexImagesTimeoutMs).toBeUndefined();
    expect(harness.fileCalls[0]?.codexDocsTimeoutMs).toBe(90_000);
  });

  test("accepts scoped options for different analyzers across new and legacy forms", async () => {
    const harness = createRenameCommandHarness();

    await harness.parse([
      "rename",
      "file",
      "sample.md",
      "--codex-images-timeout",
      "20s",
      "--codex-docs-timeout-ms",
      "40000",
    ]);

    expect(harness.fileCalls[0]).toMatchObject({
      codexImagesTimeoutMs: 20_000,
      codexDocsTimeoutMs: 40_000,
    });
    expect(harness.stderr.text.match(/Warning:/gu)).toHaveLength(1);
    expect(harness.stderr.text).toContain(
      "Use --codex-docs-timeout 40000ms instead of --codex-docs-timeout-ms.",
    );
  });

  test.each([
    {
      label: "rename file",
      args: ["rename", "file", "sample.md"],
      callKind: "file",
    },
    {
      label: "rename batch",
      args: ["rename", "batch", "./files"],
      callKind: "batch",
    },
    {
      label: "batch-rename",
      args: ["batch-rename", "./files"],
      callKind: "batch",
    },
  ])("forwards analyzer retry and batch-size values for $label", async (scenario) => {
    const harness = createRenameCommandHarness();

    await harness.parse([
      ...scenario.args,
      "--codex-images-retries",
      "3",
      "--codex-images-batch-size",
      "7",
      "--codex-docs-retries",
      "4",
      "--codex-docs-batch-size",
      "8",
    ]);

    const calls = scenario.callKind === "file" ? harness.fileCalls : harness.batchCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      codexImagesRetries: 3,
      codexImagesBatchSize: 7,
      codexDocsRetries: 4,
      codexDocsBatchSize: 8,
    });
  });
});

describe("rename legacy Codex timeout compatibility", () => {
  test("bolds and colors only the warning label on eligible stderr", async () => {
    const harness = createRenameCommandHarness({ colorEnabled: true, stderrIsTTY: true });

    await harness.parse(["rename", "file", "sample.md", "--codex-docs-timeout-ms", "30000"]);

    expect(harness.stderr.text).toStartWith(
      "\u001b[1m\u001b[33mWarning:\u001b[39m\u001b[22m legacy Codex timeout option is deprecated.\n",
    );
    expect(harness.stderr.text.replace(ANSI_PATTERN, "")).toBe(
      [
        "Warning: legacy Codex timeout option is deprecated.",
        "Use --codex-docs-timeout 30000ms instead of --codex-docs-timeout-ms.",
        "The legacy option remains supported during the current compatibility phase.",
        "",
      ].join("\n"),
    );
    expect(harness.stderr.text.slice(harness.stderr.text.indexOf(" legacy Codex"))).not.toContain(
      ANSI_START,
    );
  });

  test("preserves one legacy value and writes one exact notice", async () => {
    const harness = createRenameCommandHarness();

    await harness.parse(["rename", "file", "sample.md", "--codex-docs-timeout-ms", "30000"]);

    expect(harness.fileCalls[0]?.codexDocsTimeoutMs).toBe(30_000);
    expect(harness.stderr.text.match(/Warning:/gu)).toHaveLength(1);
    expect(harness.stderr.text).toContain(
      "Use --codex-docs-timeout 30000ms instead of --codex-docs-timeout-ms.",
    );
  });

  test("consolidates both legacy replacements into one notice", async () => {
    const harness = createRenameCommandHarness();

    await harness.parse([
      "rename",
      "batch",
      "./files",
      "--codex-images-timeout-ms",
      "15000",
      "--codex-docs-timeout-ms",
      "45000",
    ]);

    expect(harness.batchCalls[0]).toMatchObject({
      codexImagesTimeoutMs: 15_000,
      codexDocsTimeoutMs: 45_000,
    });
    expect(harness.stderr.text.match(/Warning:/gu)).toHaveLength(1);
    expect(harness.stderr.text).toContain("--codex-images-timeout 15000ms");
    expect(harness.stderr.text).toContain("--codex-docs-timeout 45000ms");
    expect(harness.stderr.text.indexOf("--codex-images-timeout 15000ms")).toBeLessThan(
      harness.stderr.text.indexOf("--codex-docs-timeout 45000ms"),
    );
  });

  test("preserves an above-cap legacy value without suggesting an invalid replacement", async () => {
    const harness = createRenameCommandHarness();

    await harness.parse(["batch-rename", "./files", "--codex-images-timeout-ms", "900000"]);

    expect(harness.batchCalls[0]?.codexImagesTimeoutMs).toBe(900_000);
    expect(harness.stderr.text.match(/Warning:/gu)).toHaveLength(1);
    expect(harness.stderr.text).toContain("cannot migrate unchanged");
    expect(harness.stderr.text).not.toContain("--codex-images-timeout 900000ms instead");
  });

  test("preserves legacy repeated-option last-value behavior", async () => {
    const harness = createRenameCommandHarness();

    await harness.parse([
      "rename",
      "file",
      "sample.md",
      "--codex-docs-timeout-ms",
      "100",
      "--codex-docs-timeout-ms",
      "200",
    ]);

    expect(harness.fileCalls[0]?.codexDocsTimeoutMs).toBe(200);
    expect(harness.stderr.text.match(/Warning:/gu)).toHaveLength(1);
    expect(harness.stderr.text).toContain("--codex-docs-timeout 200ms");
  });
});

describe("rename Codex timeout validation", () => {
  test.each([
    ["--codex-timeout", "0ms"],
    ["--codex-images-timeout", "30"],
    ["--codex-docs-timeout", "11m"],
  ])("rejects invalid %s values before action invocation", async (optionName, value) => {
    const harness = createRenameCommandHarness();

    await expectParseFailure(harness, ["rename", "file", "sample.md", optionName, value]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain(`${optionName} must be a positive integer duration`);
  });

  test.each(["--codex-timeout", "--codex-images-timeout", "--codex-docs-timeout"])(
    "rejects repeated %s values before action invocation",
    async (optionName) => {
      const harness = createRenameCommandHarness();

      await expectParseFailure(harness, [
        "rename",
        "batch",
        "./files",
        optionName,
        "30s",
        optionName,
        "45s",
      ]);

      expectNoActionCalls(harness);
      expect(harness.stderr.text).toContain(`${optionName} may only be specified once`);
    },
  );

  test.each([
    ["rename file", ["rename", "file", "sample.md"]],
    ["rename batch", ["rename", "batch", "./files"]],
    ["batch-rename", ["batch-rename", "./files"]],
  ] as const)("rejects a same-analyzer new/legacy conflict for %s", async (_label, args) => {
    const harness = createRenameCommandHarness();

    await expectParseFailure(harness, [
      ...args,
      "--codex-docs-timeout",
      "30s",
      "--codex-docs-timeout-ms",
      "60000",
    ]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain(
      "option '--codex-docs-timeout <duration>' cannot be used with option '--codex-docs-timeout-ms <ms>'",
    );
    expect(harness.stderr.text).not.toContain("Warning:");
  });

  test("rejects an image timeout conflict when the legacy option appears first", async () => {
    const harness = createRenameCommandHarness();

    await expectParseFailure(harness, [
      "rename",
      "file",
      "sample.png",
      "--codex-images-timeout-ms",
      "60000",
      "--codex-images-timeout",
      "30s",
    ]);

    expectNoActionCalls(harness);
    expect(harness.stderr.text).toContain(
      "option '--codex-images-timeout <duration>' cannot be used with option '--codex-images-timeout-ms <ms>'",
    );
    expect(harness.stderr.text).not.toContain("Warning:");
  });
});

describe("rename Codex timeout help", () => {
  test.each([
    ["rename file", ["rename", "file"], ["--prefix <value>", "--dry-run"]],
    [
      "rename batch",
      ["rename", "batch"],
      [
        "--prefix <value>",
        "--profile <name>",
        "--dry-run",
        "--preview-skips <mode>",
        "--recursive",
        "--max-depth <value>",
        "--match-regex <pattern>",
        "--skip-regex <pattern>",
        "--ext <value>",
        "--skip-ext <value>",
      ],
    ],
    [
      "batch-rename",
      ["batch-rename"],
      [
        "--prefix <value>",
        "--profile <name>",
        "--dry-run",
        "--preview-skips <mode>",
        "--recursive",
        "--max-depth <value>",
        "--match-regex <pattern>",
        "--skip-regex <pattern>",
        "--ext <value>",
        "--skip-ext <value>",
      ],
    ],
  ] as const)("keeps base, Codex, and template option ordering for %s", (_label, path, base) => {
    const harness = createRenameCommandHarness();
    const command = findCommand(harness.program, [...path]);

    expect(command.options.map((option) => option.flags)).toEqual([
      ...base,
      "--codex",
      "--codex-model <model>",
      "--codex-provider <provider-id>",
      "--codex-reasoning-effort <effort>",
      "--codex-timeout <duration>",
      "--codex-images",
      "--codex-images-timeout <duration>",
      "--codex-images-timeout-ms <ms>",
      "--codex-images-retries <count>",
      "--codex-images-batch-size <count>",
      "--codex-docs",
      "--codex-docs-timeout <duration>",
      "--codex-docs-timeout-ms <ms>",
      "--codex-docs-retries <count>",
      "--codex-docs-batch-size <count>",
      "--pattern <template>",
      "--serial-order <value>",
      "--serial-start <value>",
      "--serial-width <value>",
      "--serial-scope <value>",
      "--timestamp-timezone <value>",
    ]);
  });

  test.each([
    ["rename file", ["rename", "file", "--help"]],
    ["rename batch", ["rename", "batch", "--help"]],
    ["batch-rename", ["batch-rename", "--help"]],
  ] as const)("exposes the shared/scoped and legacy contract for %s", (_label, args) => {
    const result = runCli([...args]);
    const compactHelp = result.stdout.replace(/\s+/gu, " ");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/--codex-timeout <duration>\s+Timeout for each Codex request/u);
    expect(result.stdout).toMatch(
      /--codex-images-timeout <duration>\s+Override the per-attempt timeout/u,
    );
    expect(result.stdout).toMatch(
      /--codex-docs-timeout <duration>\s+Override the per-attempt timeout/u,
    );
    expect(compactHelp).toContain("Deprecated millisecond-only image timeout");
    expect(compactHelp).toContain("Deprecated millisecond-only document timeout");
    expect(compactHelp).toContain(
      "Retry count after the initial Codex image-title request, per batch",
    );
    expect(compactHelp).toContain(
      "Retry count after the initial Codex document-title request, per batch",
    );
  });
});
