import { describe, expect, test } from "bun:test";

import { actionDataQueryCodex } from "../src/cli/actions";
import {
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
} from "../src/cli/data-query/codex";
import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import {
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
} from "./helpers/data-query-duckdb-fixture-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

export const queryExtensions = await inspectDataQueryExtensions();
export const duckdbReady = queryExtensions.available;
export const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;
export const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;
export const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}

export {
  describe,
  expect,
  test,
  actionDataQueryCodex,
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
  inspectDataQueryExtensions,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  toRepoRelativePath,
  withTempFixtureDir,
};
