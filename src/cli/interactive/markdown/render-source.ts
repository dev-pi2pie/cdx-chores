import { checkbox, select } from "@inquirer/prompts";

import {
  prepareMarkdownPdfRender,
  type PrepareMarkdownPdfRenderInput,
  type PreparedMarkdownPdfRender,
} from "../../actions/markdown/to-pdf-service";
import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import {
  discoverMarkdownPdfRenderBundle,
  type MarkdownPdfRenderBundleCandidates,
} from "../../markdown-pdf/render-bundle";
import { resolveFromCwd } from "../../path-utils";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";

import type {
  MarkdownPdfInteractiveCustomInputMode,
  MarkdownPdfInteractiveExplicitRole,
  MarkdownPdfInteractiveRenderSource,
} from "./types";

export type MarkdownPdfInteractiveRenderSourceOutcome =
  | MarkdownPdfInteractivePreparedRenderSource
  | { kind: "back" }
  | { kind: "cancel" };

export interface MarkdownPdfInteractivePreparedRenderSource {
  kind: "prepared";
  prepared: PreparedMarkdownPdfRender;
  source: MarkdownPdfInteractiveRenderSource;
}

interface CollectedMarkdownPdfRenderSource {
  input: PrepareMarkdownPdfRenderInput;
  source: MarkdownPdfInteractiveRenderSource;
}

interface MarkdownPdfRenderSourceImplementations {
  discoverBundle?: typeof discoverMarkdownPdfRenderBundle;
  prepareRender?: typeof prepareMarkdownPdfRender;
}

const EXPLICIT_ROLE_CHOICES: ReadonlyArray<{
  description: string;
  name: string;
  value: MarkdownPdfInteractiveExplicitRole;
}> = [
  {
    name: "Profile",
    value: "profile",
    description: "Use a Markdown PDF profile file",
  },
  {
    name: "Template",
    value: "template",
    description: "Use a Pandoc HTML template",
  },
  {
    name: "Stylesheet",
    value: "css",
    description: "Use a custom CSS stylesheet",
  },
];

function formatDiscoveredBundleRoles(candidates: MarkdownPdfRenderBundleCandidates): string {
  const roles = EXPLICIT_ROLE_CHOICES.filter((choice) => candidates[choice.value].length > 0).map(
    (choice) => choice.name,
  );
  return roles.length > 0 ? roles.join(", ") : "none";
}

async function discoverBundleRolesForPreview(
  directory: string,
  discoverBundle: typeof discoverMarkdownPdfRenderBundle,
): Promise<MarkdownPdfRenderBundleCandidates> {
  const overrideTolerantCandidates = await discoverBundle(directory, { profileResolved: true });
  try {
    return await discoverBundle(directory);
  } catch {
    // Preparation runs after explicit roles are known and remains authoritative for
    // profile admission. This preview must not reject an override the renderer accepts.
    return overrideTolerantCandidates;
  }
}

async function promptExplicitRoles(message: string): Promise<MarkdownPdfInteractiveExplicitRole[]> {
  const roles = await checkbox<MarkdownPdfInteractiveExplicitRole>({
    message,
    choices: EXPLICIT_ROLE_CHOICES,
    required: true,
  });
  if (roles.length === 0) {
    throw new CliError("Select at least one explicit Markdown PDF input.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return roles;
}

async function promptExplicitInputPaths(
  roles: readonly MarkdownPdfInteractiveExplicitRole[],
  pathPromptContext: InteractivePathPromptContext,
): Promise<Pick<PrepareMarkdownPdfRenderInput, "profile" | "template" | "css">> {
  const paths: Pick<PrepareMarkdownPdfRenderInput, "profile" | "template" | "css"> = {};
  for (const role of EXPLICIT_ROLE_CHOICES) {
    if (!roles.includes(role.value)) {
      continue;
    }
    paths[role.value] = await promptRequiredPathWithConfig(`${role.name} file`, {
      kind: "file",
      ...pathPromptContext,
    });
  }
  return paths;
}

async function collectCustomInputs(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: string,
  discoverBundle: typeof discoverMarkdownPdfRenderBundle,
): Promise<CollectedMarkdownPdfRenderSource | { kind: "back" } | { kind: "cancel" }> {
  const mode = await select<MarkdownPdfInteractiveCustomInputMode | "back" | "cancel">({
    message: "Choose custom input mode",
    choices: [
      {
        name: "Explicit inputs",
        value: "explicit",
        description: "Select profile, template, or stylesheet paths directly",
      },
      {
        name: "Bundle + explicit inputs",
        value: "bundle-with-explicit",
        description: "Fill unselected roles from a bundle",
      },
      { name: "Back", value: "back", description: "Choose another recipe source" },
      { name: "Cancel", value: "cancel", description: "Exit without rendering" },
    ],
  });
  if (mode === "back" || mode === "cancel") {
    return { kind: mode };
  }

  let bundle: string | undefined;
  if (mode === "bundle-with-explicit") {
    bundle = await promptRequiredPathWithConfig("Bundle directory", {
      kind: "directory",
      ...pathPromptContext,
    });
    const candidates = await discoverBundleRolesForPreview(
      resolveFromCwd(runtime, bundle),
      discoverBundle,
    );
    printLine(runtime.stderr, `Bundle provides: ${formatDiscoveredBundleRoles(candidates)}`);
  }

  const roles = await promptExplicitRoles(
    mode === "explicit" ? "Choose explicit inputs" : "Choose explicit roles",
  );
  const explicitPaths = await promptExplicitInputPaths(roles, pathPromptContext);
  return {
    source: "custom-inputs",
    input: { input, bundle, ...explicitPaths },
  };
}

async function collectMarkdownPdfRenderSource(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  discoverBundle: typeof discoverMarkdownPdfRenderBundle,
): Promise<CollectedMarkdownPdfRenderSource | { kind: "back" } | { kind: "cancel" }> {
  const input = await promptRequiredPathWithConfig("Input Markdown file", {
    kind: "file",
    ...pathPromptContext,
  });
  while (true) {
    const source = await select<MarkdownPdfInteractiveRenderSource | "back" | "cancel">({
      message: "Choose a recipe for this PDF",
      choices: [
        {
          name: "Built-in recipe",
          value: "built-in",
          description: "Use renderer defaults",
        },
        {
          name: "Existing profile",
          value: "existing-profile",
          description: "Load a reusable Markdown PDF profile",
        },
        {
          name: "Existing bundle",
          value: "existing-bundle",
          description: "Discover Profile, Template, and Stylesheet roles from a directory",
        },
        {
          name: "Custom inputs",
          value: "custom-inputs",
          description: "Combine explicit roles with an optional bundle",
        },
        { name: "Back", value: "back", description: "Return to the Markdown menu" },
        { name: "Cancel", value: "cancel", description: "Exit without rendering" },
      ],
    });
    if (source === "back" || source === "cancel") {
      return { kind: source };
    }
    if (source === "built-in") {
      return { source, input: { input } };
    }
    if (source === "existing-profile") {
      const profile = await promptRequiredPathWithConfig("Profile file", {
        kind: "file",
        ...pathPromptContext,
      });
      return { source, input: { input, profile } };
    }
    if (source === "existing-bundle") {
      const bundle = await promptRequiredPathWithConfig("Bundle directory", {
        kind: "directory",
        ...pathPromptContext,
      });
      return { source, input: { input, bundle } };
    }
    const custom = await collectCustomInputs(runtime, pathPromptContext, input, discoverBundle);
    if ("kind" in custom && custom.kind === "back") {
      continue;
    }
    return custom;
  }
}

/** Collects one existing render source and performs its authoritative preparation exactly once. */
export async function collectPreparedMarkdownPdfRenderSource(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  implementations: MarkdownPdfRenderSourceImplementations = {},
): Promise<MarkdownPdfInteractiveRenderSourceOutcome> {
  const collected = await collectMarkdownPdfRenderSource(
    runtime,
    pathPromptContext,
    implementations.discoverBundle ?? discoverMarkdownPdfRenderBundle,
  );
  if ("kind" in collected) {
    return collected;
  }
  const prepared = await (implementations.prepareRender ?? prepareMarkdownPdfRender)(
    runtime,
    collected.input,
  );
  return { kind: "prepared", source: collected.source, prepared };
}
