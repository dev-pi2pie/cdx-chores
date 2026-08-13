import { relative } from "node:path";

import type { PreparedMarkdownPdfRender } from "../../actions/markdown/to-pdf-service";
import { displayPath, printLine } from "../../actions/shared";
import type { MarkdownPdfRenderBundleRole } from "../../markdown-pdf/render-bundle";
import type { CliRuntime } from "../../types";

import type { MarkdownPdfInteractivePreparedRenderSource } from "./render-source";
import type { MarkdownPdfInteractiveRenderSource } from "./types";
import {
  formatEffectiveMarkdownPdfCodeReview,
  formatMarkdownPdfRenderOverrideReview,
  formatReusableMarkdownPdfCodeReview,
} from "./code-highlighting-review";
import type { MarkdownPdfRenderCodeHighlightChoice } from "./render-code-highlighting";
import { formatMarkdownPdfPageNumberReview } from "./page-number-review";

const SOURCE_LABELS: Record<MarkdownPdfInteractiveRenderSource, string> = {
  "built-in": "built-in",
  "existing-profile": "existing profile",
  "existing-bundle": "existing bundle",
  "custom-inputs": "custom inputs",
};

const ROLE_LABELS: Record<MarkdownPdfRenderBundleRole, string> = {
  profile: "Profile",
  template: "Template",
  css: "Stylesheet",
};

function formatMargins(options: PreparedMarkdownPdfRender["options"]): string {
  const { top, right, bottom, left } = options.margins;
  return top === right && top === bottom && top === left
    ? top
    : `${top} ${right} ${bottom} ${left}`;
}

function formatResolvedRolePath(
  runtime: CliRuntime,
  prepared: PreparedMarkdownPdfRender,
  role: MarkdownPdfRenderBundleRole,
): string | undefined {
  const resolved = prepared.resolvedInputs[role];
  if (!resolved) {
    return undefined;
  }
  const path =
    resolved.source === "bundle" && prepared.bundleDirectory
      ? relative(prepared.bundleDirectory, resolved.path)
      : displayPath(runtime, resolved.path);
  return `${path} (${resolved.source})`;
}

export function formatMarkdownPdfRecipeReview(
  runtime: CliRuntime,
  source: MarkdownPdfInteractiveRenderSource,
  prepared: PreparedMarkdownPdfRender,
  codeHighlight: MarkdownPdfRenderCodeHighlightChoice,
): string[] {
  const lines = [
    "Markdown PDF recipe review",
    "",
    `Input: ${displayPath(runtime, prepared.inputPath)}`,
    `Recipe source: ${SOURCE_LABELS[source]}`,
  ];
  if (prepared.bundleDirectory) {
    lines.push(`Bundle source: ${displayPath(runtime, prepared.bundleDirectory)}`);
  }

  const resolvedRoles = (["profile", "template", "css"] as const)
    .map((role) => ({
      label: ROLE_LABELS[role],
      value: formatResolvedRolePath(runtime, prepared, role),
    }))
    .filter((role): role is { label: string; value: string } => role.value !== undefined);
  if (resolvedRoles.length > 0) {
    lines.push("", "Resolved recipe inputs:");
    for (const role of resolvedRoles) {
      lines.push(`- ${role.label}: ${role.value}`);
    }
  }

  lines.push(
    "",
    "Effective recipe:",
    `- Preset: ${prepared.options.preset}`,
    `- Page: ${prepared.options.pageSize} ${prepared.options.orientation}`,
    `- Margins: ${formatMargins(prepared.options)}`,
    `- ToC: ${prepared.options.toc ? `enabled (depth ${prepared.options.tocDepth}, page break ${prepared.options.tocPageBreak})` : "disabled"}`,
    `- Default CSS: ${prepared.noDefaultCss ? "disabled" : "enabled"}`,
  );
  if (prepared.resolvedInputs.profile) {
    lines.push("", ...formatReusableMarkdownPdfCodeReview(prepared.normalizedProfile.code));
  }
  lines.push(
    "",
    ...formatMarkdownPdfRenderOverrideReview(codeHighlight),
    "",
    ...formatEffectiveMarkdownPdfCodeReview(prepared.code),
  );

  if (prepared.ignoredBundleProfileFiles.length > 0) {
    lines.push("", "Bundle warnings:");
    for (const filename of prepared.ignoredBundleProfileFiles) {
      lines.push(`- Ignored unclassified YAML or JSON file: ${filename}`);
    }
  }
  lines.push("", "Dry run: no files have been written.");
  return lines;
}

export function renderMarkdownPdfRecipeReview(
  runtime: CliRuntime,
  selection: MarkdownPdfInteractivePreparedRenderSource,
): void {
  for (const line of formatMarkdownPdfRecipeReview(
    runtime,
    selection.source,
    selection.prepared,
    selection.codeHighlight,
  )) {
    printLine(runtime.stderr, line);
  }
  if (selection.pageNumbers !== undefined) {
    printLine(runtime.stderr, "");
    for (const line of formatMarkdownPdfPageNumberReview(selection.prepared)) {
      printLine(runtime.stderr, line);
    }
  }
}
