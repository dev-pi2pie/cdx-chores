import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "./helpers/cli-test-utils";

interface InteractiveHarnessScenario {
  mode: "run" | "invalid-data-action";
  selectQueue?: unknown[];
  confirmQueue?: boolean[];
  inputQueue?: string[];
  requiredPathQueue?: string[];
  optionalPathQueue?: Array<string | undefined>;
}

interface InteractiveHarnessResult {
  promptCalls: Array<{ kind: "select" | "confirm" | "input"; message: string }>;
  pathCalls: Array<{
    kind: "required" | "optional" | "hint";
    message?: string;
    options?: Record<string, unknown>;
    inputPath?: string;
    nextExtension?: string;
  }>;
  actionCalls: Array<{ name: string; options: Record<string, unknown> }>;
  stdout: string;
  stderr: string;
  error?: string;
}

const actionsModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/actions/index.ts")).href;
const pathModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/prompts/path.ts")).href;
const pathConfigModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/prompts/path-config.ts"),
).href;
const interactiveIndexUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/interactive/index.ts")).href;
const interactiveDataUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/interactive/data.ts")).href;

function runInteractiveHarness(
  scenario: InteractiveHarnessScenario,
  options: { allowFailure?: boolean } = {},
): InteractiveHarnessResult {
  const childScript = `
    import { mock } from "bun:test";

    const scenario = ${JSON.stringify(scenario)};
    const promptCalls = [];
    const pathCalls = [];
    const actionCalls = [];
    const mockedPathPromptRuntimeConfig = {
      mode: "auto",
      autocomplete: {
        enabled: true,
        minChars: 1,
        maxSuggestions: 12,
        includeHidden: false,
      },
    };

    function shiftQueueValue(queue, label) {
      if (queue.length === 0) {
        throw new Error(\`Missing queued value for \${label}\`);
      }
      return queue.shift();
    }

    mock.module("@inquirer/prompts", () => ({
      select: async (options) => {
        promptCalls.push({ kind: "select", message: options.message });
        return shiftQueueValue(scenario.selectQueue ?? [], \`select:\${options.message}\`);
      },
      confirm: async (options) => {
        promptCalls.push({ kind: "confirm", message: options.message });
        return shiftQueueValue(scenario.confirmQueue ?? [], \`confirm:\${options.message}\`);
      },
      input: async (options) => {
        promptCalls.push({ kind: "input", message: options.message });
        return shiftQueueValue(scenario.inputQueue ?? [], \`input:\${options.message}\`);
      },
    }));

    mock.module(${JSON.stringify(actionsModuleUrl)}, () => ({
      actionDoctor: async (_runtime, options) => {
        actionCalls.push({ name: "doctor", options });
      },
      actionJsonToCsv: async (_runtime, options) => {
        actionCalls.push({ name: "data:json-to-csv", options });
      },
      actionCsvToJson: async (_runtime, options) => {
        actionCalls.push({ name: "data:csv-to-json", options });
      },
      actionMdToDocx: async (_runtime, options) => {
        actionCalls.push({ name: "md:to-docx", options });
      },
      actionMdFrontmatterToJson: async (_runtime, options) => {
        actionCalls.push({ name: "md:frontmatter-to-json", options });
      },
      actionRenameBatch: async (_runtime, options) => {
        actionCalls.push({ name: "rename:batch", options });
        return {
          changedCount: 0,
          totalCount: 0,
          directoryPath: String(options.directory ?? ""),
        };
      },
      actionRenameFile: async (_runtime, options) => {
        actionCalls.push({ name: "rename:file", options });
        return {
          changed: false,
          filePath: String(options.path ?? ""),
          directoryPath: String(options.path ?? ""),
        };
      },
      actionRenameApply: async (_runtime, options) => {
        actionCalls.push({ name: "rename:apply", options });
        return {
          csvPath: String(options.csv ?? ""),
          appliedCount: 1,
          totalRows: 1,
          skippedCount: 0,
        };
      },
      actionRenameCleanup: async (_runtime, options) => {
        actionCalls.push({ name: "rename:cleanup", options });
        if (String(options.path ?? "") === "docs") {
          return {
            kind: "directory",
            changedCount: 2,
            totalCount: 3,
            directoryPath: "docs",
            planCsvPath: "plans/cleanup.csv",
          };
        }
        return {
          kind: "file",
          changed: false,
          filePath: String(options.path ?? ""),
          directoryPath: String(options.path ?? ""),
        };
      },
      actionVideoConvert: async (_runtime, options) => {
        actionCalls.push({ name: "video:convert", options });
      },
      actionVideoResize: async (_runtime, options) => {
        actionCalls.push({ name: "video:resize", options });
      },
      actionVideoGif: async (_runtime, options) => {
        actionCalls.push({ name: "video:gif", options });
      },
    }));

    mock.module(${JSON.stringify(pathModuleUrl)}, () => ({
      formatDefaultOutputPathHint: (_runtime, inputPath, nextExtension) => {
        pathCalls.push({ kind: "hint", inputPath, nextExtension });
        return \`\${inputPath}\${nextExtension}\`;
      },
      promptOptionalOutputPathChoice: async (options) => {
        pathCalls.push({ kind: "optional", message: options.message, options });
        return shiftQueueValue(scenario.optionalPathQueue ?? [], \`optional:\${options.message}\`);
      },
      promptRequiredPathWithConfig: async (message, options) => {
        pathCalls.push({ kind: "required", message, options });
        return shiftQueueValue(scenario.requiredPathQueue ?? [], \`required:\${message}\`);
      },
    }));

    mock.module(${JSON.stringify(pathConfigModuleUrl)}, () => ({
      resolvePathPromptRuntimeConfig: () => mockedPathPromptRuntimeConfig,
    }));

    class CaptureStream {
      text = "";

      write(chunk) {
        this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        return true;
      }
    }

    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const runtime = {
      cwd: process.cwd(),
      now: () => new Date("2026-02-25T00:00:00.000Z"),
      platform: process.platform,
      stdout,
      stderr,
      stdin: process.stdin,
      displayPathStyle: "relative",
    };

    try {
      if (scenario.mode === "run") {
        const { runInteractiveMode } = await import(${JSON.stringify(interactiveIndexUrl)});
        await runInteractiveMode(runtime);
      } else {
        const { handleDataInteractiveAction } = await import(${JSON.stringify(interactiveDataUrl)});
        await handleDataInteractiveAction(
          runtime,
          {
            runtimeConfig: mockedPathPromptRuntimeConfig,
            cwd: runtime.cwd,
            stdin: runtime.stdin,
            stdout: runtime.stdout,
          },
          "data:unknown",
        );
      }

      console.log(JSON.stringify({ promptCalls, pathCalls, actionCalls, stdout: stdout.text, stderr: stderr.text }));
    } catch (error) {
      console.log(
        JSON.stringify({
          promptCalls,
          pathCalls,
          actionCalls,
          stdout: stdout.text,
          stderr: stderr.text,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exitCode = 1;
    }
  `;

  const proc = Bun.spawnSync({
    cmd: [process.execPath, "-e", childScript],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = Buffer.from(proc.stdout).toString("utf8").trim();
  const stderr = Buffer.from(proc.stderr).toString("utf8");

  if (!stdout) {
    throw new Error(`Interactive harness produced no stdout.\n${stderr}`);
  }

  const parsed = JSON.parse(stdout) as InteractiveHarnessResult;
  if (proc.exitCode !== 0 && !(options.allowFailure ?? false)) {
    throw new Error(`Interactive harness failed: ${parsed.error ?? stderr}`);
  }

  return parsed;
}

describe("interactive mode routing", () => {
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

  test("routes a data flow and passes shared path prompt context", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:json-to-csv"],
      requiredPathQueue: ["fixtures/input.json"],
      optionalPathQueue: [undefined],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:json-to-csv",
        options: {
          input: "fixtures/input.json",
          output: null,
          overwrite: true,
        },
      },
    ]);
    expect(result.pathCalls[0]).toMatchObject({
      kind: "required",
      message: "Input JSON file",
      options: {
        kind: "file",
        runtimeConfig: {
          mode: "auto",
          autocomplete: {
            enabled: true,
            minChars: 1,
            maxSuggestions: 12,
            includeHidden: false,
          },
        },
        cwd: REPO_ROOT,
      },
    });
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

  test("uses the shortened custom template hint text", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:file", "custom", "path_asc"],
      requiredPathQueue: ["README.md"],
      inputQueue: ["{date}-{stem}-{serial}", "1", ""],
      confirmQueue: [true, false],
    });

    expect(result.promptCalls).toContainEqual({
      kind: "input",
      message: [
        "Custom filename template",
        "Main placeholders: {prefix}, {timestamp}, {date}, {stem}, {serial}",
        "Advanced: explicit timestamp variants and {serial...} params are also supported.",
      ].join("\n"),
    });
  });

  test("routes a cleanup file flow", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "date", "done", "preserve"],
      requiredPathQueue: ["README.md"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "README.md",
          hints: ["date"],
          style: "preserve",
          dryRun: true,
        },
      },
    ]);
  });

  test("routes a cleanup directory dry-run flow and offers immediate apply", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:cleanup", "timestamp", "done", "slug", "remove", "detailed"],
      requiredPathQueue: ["docs"],
      inputQueue: [""],
      confirmQueue: [true, false, true, true, true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:cleanup",
        options: {
          path: "docs",
          hints: ["timestamp"],
          style: "slug",
          timestampAction: "remove",
          recursive: true,
          dryRun: true,
          previewSkips: "detailed",
        },
      },
      {
        name: "rename:apply",
        options: {
          csv: "plans/cleanup.csv",
          autoClean: true,
        },
      },
    ]);
  });

  test("routes a video flow through gif generation", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["video", "video:gif"],
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
          width: 320,
          fps: 12,
          overwrite: false,
        },
      },
    ]);
  });

  test("throws when a handler receives an unknown action", () => {
    const result = runInteractiveHarness({ mode: "invalid-data-action" }, { allowFailure: true });

    expect(result.error).toBe("Unhandled interactive action: data:unknown");
  });
});
