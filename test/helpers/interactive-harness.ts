import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "./cli-test-utils";

export interface InteractiveHarnessScenario {
  mode: "run" | "invalid-data-action";
  selectQueue?: unknown[];
  confirmQueue?: boolean[];
  inputQueue?: string[];
  requiredPathQueue?: string[];
  optionalPathQueue?: Array<string | undefined>;
}

export interface InteractiveHarnessResult {
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

export function runInteractiveHarness(
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
      resolveRenameCleanupTarget: async (_runtime, inputPath) => {
        if (String(inputPath) === "docs") {
          return { kind: "directory", path: "docs" };
        }
        return { kind: "file", path: String(inputPath ?? "") };
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
