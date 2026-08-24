import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "../../helpers/cli-test-utils";

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
