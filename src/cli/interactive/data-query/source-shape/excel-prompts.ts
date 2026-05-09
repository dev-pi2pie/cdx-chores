import { input } from "@inquirer/prompts";

import {
  normalizeExcelBodyStartRow,
  normalizeExcelHeaderRow,
  normalizeExcelRange,
} from "../../../duckdb/query";
import type { InteractiveSourceShapeState } from "../types";

function validateExcelRangeInput(value: string, options: { required: boolean }): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.required ? "Enter an Excel range like A1:Z99." : true;
  }

  try {
    normalizeExcelRange(trimmed);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function promptOptionalExcelRange(defaultValue = ""): Promise<string | undefined> {
  const value = await input({
    message: "Excel range (optional, e.g. A1:Z99)",
    default: defaultValue,
    validate: (nextValue) => validateExcelRangeInput(nextValue, { required: false }),
  });

  const trimmed = value.trim();
  return trimmed.length > 0 ? normalizeExcelRange(trimmed) : undefined;
}

export async function promptRequiredExcelRange(defaultValue = ""): Promise<string> {
  const value = await input({
    message: "Excel range (required, e.g. A1:Z99)",
    default: defaultValue,
    validate: (nextValue) => validateExcelRangeInput(nextValue, { required: true }),
  });

  return normalizeExcelRange(value.trim());
}

function validateExcelHeaderRowInput(value: string, options: { required: boolean }): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.required ? "Enter a positive worksheet row number." : true;
  }

  try {
    normalizeExcelHeaderRow(Number(trimmed));
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function promptOptionalExcelHeaderRow(defaultValue = ""): Promise<number | undefined> {
  const value = await input({
    message: "Excel header row (optional, absolute worksheet row)",
    default: defaultValue,
    validate: (nextValue) => validateExcelHeaderRowInput(nextValue, { required: false }),
  });

  const trimmed = value.trim();
  return trimmed.length > 0 ? normalizeExcelHeaderRow(Number(trimmed)) : undefined;
}

function validateExcelBodyStartRowInput(
  value: string,
  options: { required: boolean },
): true | string {
  const trimmed = value.trim();
  if (!trimmed) {
    return options.required ? "Enter a positive worksheet row number." : true;
  }

  try {
    normalizeExcelBodyStartRow(Number(trimmed));
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function promptOptionalExcelBodyStartRow(defaultValue = ""): Promise<number | undefined> {
  const value = await input({
    message: "Excel body start row (optional, absolute worksheet row)",
    default: defaultValue,
    validate: (nextValue) => validateExcelBodyStartRowInput(nextValue, { required: false }),
  });

  const trimmed = value.trim();
  return trimmed.length > 0 ? normalizeExcelBodyStartRow(Number(trimmed)) : undefined;
}

export async function promptRequiredSourceShapeState(
  defaultShape: {
    bodyStartRow?: number;
    headerRow?: number;
    range?: string;
  } = {},
): Promise<InteractiveSourceShapeState> {
  while (true) {
    const selectedRange = await promptOptionalExcelRange(defaultShape.range ?? "");
    const selectedBodyStartRow = await promptOptionalExcelBodyStartRow(
      defaultShape.bodyStartRow !== undefined ? String(defaultShape.bodyStartRow) : "",
    );
    const selectedHeaderRow = await promptOptionalExcelHeaderRow(
      defaultShape.headerRow !== undefined ? String(defaultShape.headerRow) : "",
    );
    if (selectedRange || selectedHeaderRow !== undefined || selectedBodyStartRow !== undefined) {
      return {
        ...(selectedBodyStartRow !== undefined ? { selectedBodyStartRow } : {}),
        ...(selectedHeaderRow !== undefined ? { selectedHeaderRow } : {}),
        ...(selectedRange ? { selectedRange } : {}),
      };
    }
  }
}
