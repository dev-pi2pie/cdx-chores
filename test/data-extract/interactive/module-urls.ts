import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "../../helpers/cli-test-utils";

export const duckdbQueryModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/query.ts"),
).href;
export const xlsxSourcesModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/xlsx-sources.ts"),
).href;
export const sourceShapeModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/source-shape.ts"),
).href;
