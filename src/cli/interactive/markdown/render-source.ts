import { checkbox, select } from "@inquirer/prompts";

import {
  prepareMarkdownPdfRender,
  type PrepareMarkdownPdfRenderInput,
  type PreparedMarkdownPdfRender,
} from "../../actions/markdown/to-pdf-service";
import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import {
  previewMarkdownPdfRenderBundle,
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
  MarkdownPdfInteractiveSource,
} from "./types";
import type { MarkdownPdfSavedRecipe } from "./codex-types";
import {
  compileMarkdownPdfRenderCodeHighlightChoice,
  type MarkdownPdfRenderCodeHighlightChoice,
} from "./render-code-highlighting";

export type MarkdownPdfInteractiveRenderSourceSelectionOutcome =
  | MarkdownPdfInteractiveSelectedRenderSource
  | { kind: "generated" }
  | { kind: "back" }
  | { kind: "cancel" };

export interface MarkdownPdfInteractivePreparedRenderSource {
  codeHighlight: MarkdownPdfRenderCodeHighlightChoice;
  kind: "prepared";
  prepared: PreparedMarkdownPdfRender;
  selected: MarkdownPdfInteractiveSelectedRenderSource;
  source: MarkdownPdfInteractiveRenderSource;
}

export interface MarkdownPdfInteractiveSelectedRenderSource {
  input: PrepareMarkdownPdfRenderInput;
  kind: "selected";
  source: MarkdownPdfInteractiveRenderSource;
}

interface MarkdownPdfRenderSourceImplementations {
  previewBundle?: typeof previewMarkdownPdfRenderBundle;
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
  previewBundle: typeof previewMarkdownPdfRenderBundle = previewMarkdownPdfRenderBundle,
): Promise<MarkdownPdfInteractiveSelectedRenderSource | { kind: "back" } | { kind: "cancel" }> {
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
    const candidates = await previewBundle(resolveFromCwd(runtime, bundle));
    printLine(runtime.stderr, `Bundle provides: ${formatDiscoveredBundleRoles(candidates)}`);
  }

  const roles = await promptExplicitRoles(
    mode === "explicit" ? "Choose explicit inputs" : "Choose explicit roles",
  );
  const explicitPaths = await promptExplicitInputPaths(roles, pathPromptContext);
  return {
    kind: "selected",
    source: "custom-inputs",
    input: { input, bundle, ...explicitPaths },
  };
}

export async function collectMarkdownPdfRenderSource(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: string,
  previewBundle: typeof previewMarkdownPdfRenderBundle = previewMarkdownPdfRenderBundle,
): Promise<MarkdownPdfInteractiveRenderSourceSelectionOutcome> {
  while (true) {
    const source = await select<MarkdownPdfInteractiveSource | "back" | "cancel">({
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
        {
          name: "Create a recipe",
          value: "generated",
          description: "Prepare a Profile, Template bundle, or Project bundle",
        },
        { name: "Back", value: "back", description: "Return to the Markdown menu" },
        { name: "Cancel", value: "cancel", description: "Exit without rendering" },
      ],
    });
    if (source === "back" || source === "cancel") {
      return { kind: source };
    }
    if (source === "generated") {
      return { kind: "generated" };
    }
    if (source === "built-in") {
      return { kind: "selected", source, input: { input } };
    }
    if (source === "existing-profile") {
      const profile = await promptRequiredPathWithConfig("Profile file", {
        kind: "file",
        ...pathPromptContext,
      });
      return { kind: "selected", source, input: { input, profile } };
    }
    if (source === "existing-bundle") {
      const bundle = await promptRequiredPathWithConfig("Bundle directory", {
        kind: "directory",
        ...pathPromptContext,
      });
      return { kind: "selected", source, input: { input, bundle } };
    }
    const custom = await collectCustomInputs(runtime, pathPromptContext, input, previewBundle);
    if ("kind" in custom && custom.kind === "back") {
      continue;
    }
    return custom;
  }
}

export async function promptMarkdownPdfRenderInput(
  pathPromptContext: InteractivePathPromptContext,
): Promise<string> {
  return await promptRequiredPathWithConfig("Input Markdown file", {
    kind: "file",
    ...pathPromptContext,
  });
}

export async function prepareMarkdownPdfRenderSource(
  runtime: CliRuntime,
  selected: MarkdownPdfInteractiveSelectedRenderSource,
  codeHighlight: MarkdownPdfRenderCodeHighlightChoice,
  implementations: Pick<MarkdownPdfRenderSourceImplementations, "prepareRender"> = {},
): Promise<MarkdownPdfInteractivePreparedRenderSource> {
  const compiledCodeHighlight = compileMarkdownPdfRenderCodeHighlightChoice(codeHighlight);
  const prepared = await (implementations.prepareRender ?? prepareMarkdownPdfRender)(runtime, {
    ...selected.input,
    ...(compiledCodeHighlight === undefined ? {} : { codeHighlight: compiledCodeHighlight }),
  });
  return {
    codeHighlight,
    kind: "prepared",
    prepared,
    selected,
    source: selected.source,
  };
}

export function selectSavedMarkdownPdfRenderSource(
  input: string,
  saved: MarkdownPdfSavedRecipe,
): MarkdownPdfInteractiveSelectedRenderSource {
  return {
    input: {
      input,
      ...(saved.rendererSource === "existing-profile"
        ? { profile: saved.outputPath }
        : { bundle: saved.outputPath }),
    },
    kind: "selected",
    source: saved.rendererSource,
  };
}
