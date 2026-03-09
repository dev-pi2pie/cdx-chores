import { expect } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionDataPreview, type DataPreviewOptions } from "../../src/cli/actions";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";

export const ANSI_ESCAPE = String.fromCharCode(0x1b);
const ANSI_PATTERN = new RegExp(`${ANSI_ESCAPE}\\[[0-9;]*m`, "g");

type ActionTestRuntime = ReturnType<typeof createActionTestRuntime>;
type ActionTestRuntimeOptions = Parameters<typeof createActionTestRuntime>[0];

export interface DataPreviewTestContext extends ActionTestRuntime {
  fixtureDir: string;
  input: string;
  inputPath: string;
}

export interface DataPreviewRunContext {
  input: string;
  runtime: ActionTestRuntime["runtime"];
}

export function enableTty(runtime: { stdout: NodeJS.WritableStream }, columns: number): void {
  const stream = runtime.stdout as NodeJS.WritableStream & { columns?: number; isTTY?: boolean };
  stream.isTTY = true;
  stream.columns = columns;
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export function expectAnsi(text: string): void {
  expect(text).toMatch(ANSI_PATTERN);
}

export function expectNoAnsi(text: string): void {
  expect(text).not.toMatch(ANSI_PATTERN);
}

export async function runDataPreview(
  context: DataPreviewRunContext,
  options: Omit<DataPreviewOptions, "input"> = {},
): Promise<void> {
  await actionDataPreview(context.runtime, {
    ...options,
    input: context.input,
  });
}

export async function withDataPreviewFixture<T>(options: {
  content: string;
  fileName: string;
  run: (context: DataPreviewTestContext) => Promise<T>;
  runtimeOptions?: ActionTestRuntimeOptions;
}): Promise<T> {
  return await withTempFixtureDir("data-preview", async (fixtureDir) => {
    const inputPath = join(fixtureDir, options.fileName);
    await writeFile(inputPath, options.content, "utf8");

    return await options.run({
      ...createActionTestRuntime(options.runtimeOptions),
      fixtureDir,
      input: toRepoRelativePath(inputPath),
      inputPath,
    });
  });
}
