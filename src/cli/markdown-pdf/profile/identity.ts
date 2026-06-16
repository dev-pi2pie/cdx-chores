import { CliError } from "../../errors";
import { MARKDOWN_PDF_PRESETS, type MarkdownPdfPreset } from "../validation";
import type { MarkdownPdfProfileSource, NormalizedMarkdownPdfProfileIdentity } from "./types";

const MARKDOWN_PDF_PRESET_VALUES = new Set<string>(MARKDOWN_PDF_PRESETS);
const MARKDOWN_PDF_PROFILE_SOURCE_VALUES = new Set<MarkdownPdfProfileSource>([
  "codex",
  "deterministic",
]);
const PROFILE_ID_PATTERN = /^md-pdf-profile-\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function assertIdentityObject(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return value as Record<string, unknown>;
  }
  throw new CliError("profile.profile must be a plain object.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
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

function isStrictUtcTimestamp(value: string): boolean {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value.replace("Z", ".000Z");
}

function assertProfileId(value: string): void {
  if (PROFILE_ID_PATTERN.test(value)) {
    return;
  }
  throw new CliError("profile.profile.id must use md-pdf-profile-YYYYMMDDTHHMMSSZ-xxxxxxxx.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function assertCreatedAt(value: string): void {
  if (isStrictUtcTimestamp(value)) {
    return;
  }
  throw new CliError("profile.profile.createdAt must be an ISO date-time string.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function isMarkdownPdfProfileSource(value: string): value is MarkdownPdfProfileSource {
  return MARKDOWN_PDF_PROFILE_SOURCE_VALUES.has(value as MarkdownPdfProfileSource);
}

export function normalizeMarkdownPdfProfileIdentity(
  value: unknown,
): NormalizedMarkdownPdfProfileIdentity | undefined {
  if (value === undefined) {
    return undefined;
  }
  const input = assertIdentityObject(value);
  const id = stringValue(input.id, "profile.profile.id");
  const source = stringValue(input.source, "profile.profile.source");
  const createdAt = stringValue(input.createdAt, "profile.profile.createdAt");

  if (!id || !source || !createdAt) {
    throw new CliError("profile.profile requires id, source, and createdAt.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  assertProfileId(id);
  if (!isMarkdownPdfProfileSource(source)) {
    throw new CliError("profile.profile.source must be codex or deterministic.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  assertCreatedAt(createdAt);

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
