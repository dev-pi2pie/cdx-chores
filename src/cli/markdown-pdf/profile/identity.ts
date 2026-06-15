import { CliError } from "../../errors";
import { MARKDOWN_PDF_PRESETS, type MarkdownPdfPreset } from "../validation";
import type { NormalizedMarkdownPdfProfileIdentity } from "./types";

const MARKDOWN_PDF_PRESET_VALUES = new Set<string>(MARKDOWN_PDF_PRESETS);

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringValue(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new CliError(`${label} must be a string.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new CliError(`${label} must not be empty.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return trimmed;
}

export function normalizeMarkdownPdfProfileIdentity(
  value: unknown,
): NormalizedMarkdownPdfProfileIdentity | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = readObject(value);
  const id = stringValue(input.id, "profile.profile.id");
  const source = stringValue(input.source, "profile.profile.source");
  const createdAt = stringValue(input.createdAt, "profile.profile.createdAt");

  if (!id || !source || !createdAt) {
    throw new CliError("profile.profile requires id, source, and createdAt.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (source !== "codex") {
    throw new CliError("profile.profile.source must be codex.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new CliError("profile.profile.createdAt must be an ISO date-time string.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const preset = stringValue(input.preset, "profile.profile.preset");
  if (preset && !MARKDOWN_PDF_PRESET_VALUES.has(preset)) {
    throw new CliError(
      `profile.profile.preset must be one of: ${MARKDOWN_PDF_PRESETS.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    id,
    source,
    basedOn: stringValue(input.basedOn, "profile.profile.basedOn"),
    preset: preset as MarkdownPdfPreset | undefined,
    createdAt,
  };
}
