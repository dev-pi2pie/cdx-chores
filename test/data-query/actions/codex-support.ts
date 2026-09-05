import { describe, expect, test } from "bun:test";

import { actionDataQueryCodex } from "../../../src/cli/actions";
import {
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
} from "../../../src/cli/data-query/codex";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import {
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
} from "../../data-sources/fixtures/duckdb";
import { seedDataExtractFixtures } from "../../data-sources/fixtures/tabular";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

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
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  toRepoRelativePath,
  withTempFixtureDir,
};
