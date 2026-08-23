import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "../cli-test-utils";

export const interactiveHarnessRunnerPath = resolve(
  REPO_ROOT,
  "test/helpers/interactive-harness/runner.ts",
);
export const actionsModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/actions/index.ts")).href;
export const pathModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/prompts/path.ts")).href;
export const pathConfigModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/prompts/path-config.ts"),
).href;
export const markdownPdfRenderServiceModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/actions/markdown/to-pdf-service.ts"),
).href;
export const markdownPdfRenderBundleModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/markdown-pdf/render-bundle.ts"),
).href;
export const markdownPdfProjectBundleCompletenessModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/markdown-pdf/project-codex/project-bundle-completeness.ts"),
).href;
export const markdownPdfDeterministicAuthoringModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/markdown/deterministic-authoring.ts"),
).href;
export const markdownPdfCodexServiceModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/markdown/codex-service.ts"),
).href;
export const markdownPdfLifecycleModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/markdown/lifecycle.ts"),
).href;
export const fontDiscoveryModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/fonts/discovery.ts"),
).href;
export const interactiveIndexUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/index.ts"),
).href;
export const interactiveDataUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/data.ts"),
).href;
