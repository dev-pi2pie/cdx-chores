import { link, lstat, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
} from "../../../src/adapters/codex/markdown-pdf-profile";
import { actionMdPdfProfileCodex } from "../../../src/cli/actions";
import type { CodexProgressPresenter } from "../../../src/cli/actions/codex-progress";
import { readMarkdownPdfCodexReportArtifact } from "../../../src/cli/markdown-pdf/codex-report";
import { readMarkdownPdfProfileFile } from "../../../src/cli/markdown-pdf";
import { prepareMarkdownPdfProfileCodex } from "../../../src/cli/markdown-pdf/profile-codex";
import type { NormalizedMarkdownPdfProfileIdentity } from "../../../src/cli/markdown-pdf/profile";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { pathExists } from "../support/path-fixtures";

export { link, lstat, mkdir, readdir, readFile, symlink, writeFile };
export { join };
export { afterEach, describe, expect, mock, test };
export {
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  actionMdPdfProfileCodex,
  createActionTestRuntime,
  expectCliError,
  pathExists,
  prepareMarkdownPdfProfileCodex,
  readMarkdownPdfCodexReportArtifact,
  readMarkdownPdfProfileFile,
  withTempFixtureDir,
};
export type { CodexProgressPresenter, NormalizedMarkdownPdfProfileIdentity };

export function adaptedRunner(candidateId = "wide-table") {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [
        { op: "replace", path: "/toc/enabled", value: true },
        { op: "replace", path: "/toc/depth", value: 2 },
      ],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
      ],
      reasoning: "The document has enough structure for a reusable profile.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
}

export function pageNumberRunner(
  candidateId = "default",
  patches: Array<{ op: "replace"; path: string; value: boolean | number | string }> = [
    { op: "replace", path: "/pageNumbers/enabled", value: true },
    { op: "replace", path: "/pageNumbers/scope", value: "body" },
    { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
    { op: "replace", path: "/pageNumbers/start", value: 0 },
    { op: "replace", path: "/pageNumbers/increment", value: 2 },
    { op: "replace", path: "/pageNumbers/position", value: "top-right" },
    { op: "replace", path: "/pageNumbers/format", value: "Page {page} of {pages}" },
  ],
) {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: patches,
      accepted_font_patches: [],
      reasoning: "Use the requested durable page-number configuration.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
}

export function allFontPatchRunner(candidateId = "default") {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
        { op: "replace-font", role: "code", key: "default", value: "JetBrains Mono" },
        { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
        { op: "replace-font", role: "heading", key: "default", value: "Inter" },
        { op: "replace-font", role: "pageChrome", key: "default", value: "Inter" },
      ],
      reasoning: "Font hints and document language signals fit dedicated font patches.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
}

export function profilePromptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("profile Codex prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

export function candidateSummaryIds(facts: Record<string, unknown>): string[] {
  return ((facts.candidateSummaries as Array<{ id: string }> | undefined) ?? []).map(
    (summary) => summary.id,
  );
}
