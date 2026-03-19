import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "../cli-test-utils";

export const interactiveHarnessRunnerPath = resolve(
  REPO_ROOT,
  "test/helpers/interactive-harness/runner.ts",
);
export const actionsModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/actions/index.ts"),
).href;
export const pathModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/prompts/path.ts"),
).href;
export const pathConfigModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/prompts/path-config.ts"),
).href;
export const interactiveIndexUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/index.ts"),
).href;
export const interactiveDataUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/data.ts"),
).href;
export const dataQueryCodexModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/data-query/codex.ts"),
).href;
export const dataQueryHeaderMappingModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/header-mapping.ts"),
).href;
export const duckdbQueryModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/query.ts"),
).href;
export const xlsxSourcesModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/xlsx-sources.ts"),
).href;
export const sourceShapeModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/source-shape.ts"),
).href;
