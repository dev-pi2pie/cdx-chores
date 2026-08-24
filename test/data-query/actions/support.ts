import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionDataQuery } from "../../../src/cli/actions";
import { getDisplayWidth } from "../../../src/cli/text-display-width";
import {
  createDuckDbConnection,
  inspectDataQueryExtensions,
  listDataQuerySources,
} from "../../../src/cli/duckdb/query";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import {
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
} from "../../data-sources/fixtures/duckdb";
import { seedStackedMergedBandFixture } from "../../data-sources/fixtures/stacked-merged-band";
import { seedDataExtractFixtures } from "../../data-sources/fixtures/tabular";
import { REPO_ROOT, toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

export function dataQueryFixturePath(name: string): string {
  return join(REPO_ROOT, "test", "data-sources", "fixtures", name);
}

export class TtyCaptureStream {
  public text = "";
  public isTTY = true;

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

export const queryExtensions = await inspectDataQueryExtensions();
export const duckdbReady = queryExtensions.available;
export const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;
export const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;

export {
  describe,
  expect,
  test,
  readFile,
  writeFile,
  join,
  actionDataQuery,
  getDisplayWidth,
  createDuckDbConnection,
  inspectDataQueryExtensions,
  listDataQuerySources,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedAmbiguousDuckDbSourceFixture,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  REPO_ROOT,
  toRepoRelativePath,
  withTempFixtureDir,
  seedStackedMergedBandFixture,
};
