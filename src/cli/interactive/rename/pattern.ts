import { input, select } from "@inquirer/prompts";

import { promptTextWithGhost } from "../../prompts/text-inline";
import {
  type RenameSerialOrder,
  type RenameSerialScope,
  type RenameTemplatePreset,
  type TimestampTimezone,
  RENAME_SERIAL_ORDER_VALUES,
  normalizeSerialPlaceholderInTemplate,
  resolveRenamePatternTemplate,
  resolveTimestampPatternForInteractive,
  shouldPromptTimestampTimezone,
  templateContainsPrefixPlaceholder,
  templateContainsSerialPlaceholder,
} from "../../rename-template";
import { validateIntegerInput } from "../input-validation";
import type { InteractivePathPromptContext } from "../shared";

export interface RenamePatternPromptConfig {
  pattern: string;
  usesPrefix: boolean;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope: RenameSerialScope;
}

export async function promptRenamePatternConfig(options: {
  includeSerialScope: boolean;
  pathPromptContext: InteractivePathPromptContext;
}): Promise<RenamePatternPromptConfig> {
  const preset = await select<RenameTemplatePreset>({
    message: "Filename template preset",
    choices: [
      {
        name: "default",
        value: "default",
        description: "{prefix}-{timestamp}-{stem}",
      },
      {
        name: "timestamp-first",
        value: "timestamp-first",
        description: "{timestamp}-{prefix}-{stem}",
      },
      {
        name: "stem-first",
        value: "stem-first",
        description: "{stem}-{timestamp}-{prefix}",
      },
      {
        name: "custom",
        value: "custom",
        description: "Provide a custom template string",
      },
    ],
  });

  const customTemplate =
    preset === "custom"
      ? await promptTextWithGhost({
          message: "Template",
          helpLines: [
            "Custom filename template",
            "Main placeholders: {prefix}, {timestamp}, {date}, {stem}, {uid}, {serial}",
            "Advanced: explicit timestamp variants and {serial...} params are also supported.",
          ],
          ghostHintLabel: "Template suggestion (Right arrow to accept)",
          ghostText: "{timestamp}-{stem}",
          completionKind: "rename-template",
          runtimeConfig: options.pathPromptContext.runtimeConfig,
          stdin: options.pathPromptContext.stdin,
          stdout: options.pathPromptContext.stdout,
          validate: (value) => (value.trim() ? true : "Required"),
        })
      : undefined;

  const basePattern = resolveRenamePatternTemplate({
    preset,
    customTemplate,
  });
  const usesPrefix = templateContainsPrefixPlaceholder(basePattern);
  const usesSerial = templateContainsSerialPlaceholder(basePattern);

  const serialOrder = usesSerial
    ? await select<RenameSerialOrder>({
        message: "Serial order",
        choices: RENAME_SERIAL_ORDER_VALUES.map((value) => ({
          name: value,
          value,
          description: value.startsWith("mtime_")
            ? "mtime uses file modified time"
            : "path uses deterministic path ordering",
        })),
        default: "path_asc",
      })
    : undefined;

  const serialStartInput = usesSerial
    ? await input({
        message: "Serial start number",
        default: "1",
        validate: (value) => validateIntegerInput(value, { min: 0 }),
      })
    : "";

  const serialWidthInput = usesSerial
    ? await input({
        message: "Serial min width in digits (optional, e.g. 2 => 01)",
        default: "",
        validate: (value) => validateIntegerInput(value, { min: 1, allowEmpty: true }),
      })
    : "";

  const serialScope =
    options.includeSerialScope && usesSerial
      ? await select<RenameSerialScope>({
          message: "Serial scope",
          choices: [
            {
              name: "global",
              value: "global",
              description: "Single serial sequence across recursive traversal",
            },
            {
              name: "directory",
              value: "directory",
              description: "Reset serial per directory when recursive",
            },
          ],
          default: "global",
        })
      : "global";

  const serialStart = serialStartInput.trim() ? Number(serialStartInput.trim()) : undefined;
  const serialWidth = serialWidthInput.trim() ? Number(serialWidthInput.trim()) : undefined;
  const pattern =
    usesSerial && serialOrder !== undefined && serialStart !== undefined
      ? normalizeSerialPlaceholderInTemplate({
          template: basePattern,
          serial: {
            order: serialOrder,
            start: serialStart,
            width: serialWidth,
          },
        })
      : basePattern;

  const timestampTimezone: TimestampTimezone | undefined = shouldPromptTimestampTimezone(pattern)
    ? await select<TimestampTimezone>({
        message: "Timestamp timezone basis",
        choices: [
          {
            name: "utc",
            value: "utc",
            description: "Stable cross-machine/audit naming (default)",
          },
          {
            name: "local",
            value: "local",
            description: "Local clock naming for personal use",
          },
        ],
        default: "utc",
      })
    : undefined;

  const finalPattern = resolveTimestampPatternForInteractive(pattern, timestampTimezone);

  return {
    pattern: finalPattern,
    usesPrefix,
    serialOrder,
    serialStart,
    serialWidth,
    serialScope,
  };
}
