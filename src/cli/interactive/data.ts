import { confirm, input, select } from "@inquirer/prompts";
import { extname } from "node:path";

import {
  actionCsvToJson,
  actionCsvToTsv,
  actionDataParquetPreview,
  actionDataPreview,
  actionJsonToCsv,
  actionJsonToTsv,
  actionTsvToCsv,
  actionTsvToJson,
  loadDataPreviewSource,
} from "../actions";
import {
  assertContainsFilterColumns,
  parseContainsFilterValue,
  type DataPreviewContainsFilter,
  type DataPreviewSource,
} from "../data-preview/source";
import {
  formatDefaultOutputPathHint,
  promptOptionalOutputPathChoice,
  promptRequiredPathWithConfig,
} from "../prompts/path";
import type { CliRuntime } from "../types";
import { runInteractiveDataQuery } from "./data-query";
import type { DataInteractiveActionKey } from "./menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";
import { CliError } from "../errors";
import { printLine } from "../actions/shared";

type LightweightInteractiveDataFormat = "csv" | "tsv" | "json";

function detectInteractiveDataFormat(inputPath: string): LightweightInteractiveDataFormat {
  const extension = extname(inputPath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv" || extension === ".json") {
    return extension.slice(1) as LightweightInteractiveDataFormat;
  }

  throw new CliError(
    `Unsupported lightweight data file type: ${extension || "(none)"}. Expected .csv, .tsv, or .json.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function getInteractiveTargetChoices(
  sourceFormat: LightweightInteractiveDataFormat,
): Array<{ name: string; value: LightweightInteractiveDataFormat }> {
  return (["csv", "tsv", "json"] as const)
    .filter((format) => format !== sourceFormat)
    .map((format) => ({
      name: format.toUpperCase(),
      value: format,
    }));
}

async function runInteractiveDataConvert(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const inputPath = await promptRequiredPathWithConfig("Input CSV, TSV, or JSON file", {
    kind: "file",
    ...pathPromptContext,
  });
  const sourceFormat = detectInteractiveDataFormat(inputPath);
  printLine(runtime.stderr, `Detected source format: ${sourceFormat}`);

  const targetFormat = await select<LightweightInteractiveDataFormat>({
    message: "Convert to",
    choices: getInteractiveTargetChoices(sourceFormat),
  });

  const outputHint = formatDefaultOutputPathHint(runtime, inputPath, `.${targetFormat}`);
  const outputPath = await promptOptionalOutputPathChoice({
    message: `Output ${targetFormat.toUpperCase()} file`,
    defaultHint: outputHint,
    kind: "file",
    ...pathPromptContext,
    customMessage: `Custom ${targetFormat.toUpperCase()} output path`,
  });
  const pretty = targetFormat === "json"
    ? await confirm({ message: "Pretty-print JSON?", default: true })
    : undefined;
  const overwrite = await confirm({ message: "Overwrite if exists?", default: false });

  if (sourceFormat === "json" && targetFormat === "csv") {
    await actionJsonToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "json" && targetFormat === "tsv") {
    await actionJsonToTsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "csv" && targetFormat === "json") {
    await actionCsvToJson(runtime, { input: inputPath, output: outputPath, overwrite, pretty });
    return;
  }
  if (sourceFormat === "csv" && targetFormat === "tsv") {
    await actionCsvToTsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "tsv" && targetFormat === "csv") {
    await actionTsvToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }
  if (sourceFormat === "tsv" && targetFormat === "json") {
    await actionTsvToJson(runtime, { input: inputPath, output: outputPath, overwrite, pretty });
    return;
  }

  throw new CliError(`Unsupported conversion target: ${sourceFormat} -> ${targetFormat}.`, {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

function toContainsValidationMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function promptContainsFilters(
  runtime: CliRuntime,
  inputPath: string,
): Promise<string[] | undefined> {
  let sourcePromise: Promise<DataPreviewSource> | undefined;
  const getSource = async (): Promise<DataPreviewSource> => {
    sourcePromise ??= loadDataPreviewSource(runtime, inputPath).then((loaded) => loaded.source);
    return await sourcePromise;
  };

  const validateContains = async (
    value: string,
    options: { allowBlank: boolean },
  ): Promise<true | string> => {
    const trimmed = value.trim();
    if (!trimmed) {
      return options.allowBlank ? true : "Enter a contains filter in column:keyword format.";
    }

    let parsedFilter: DataPreviewContainsFilter;
    try {
      parsedFilter = parseContainsFilterValue(trimmed);
    } catch (error) {
      return toContainsValidationMessage(error);
    }

    try {
      assertContainsFilterColumns(await getSource(), [parsedFilter]);
    } catch (error) {
      return toContainsValidationMessage(error);
    }

    return true;
  };

  const firstContainsInput = await input({
    message: "Contains filter (column:keyword, optional)",
    default: "",
    validate: async (value) => await validateContains(value, { allowBlank: true }),
  });

  const contains = firstContainsInput.trim() ? [firstContainsInput.trim()] : [];
  while (contains.length > 0 && await confirm({ message: "Add another contains filter?", default: false })) {
    const nextContainsInput = await input({
      message: "Another contains filter (column:keyword)",
      default: "",
      validate: async (value) => await validateContains(value, { allowBlank: false }),
    });
    contains.push(nextContainsInput.trim());
  }

  return contains.length > 0 ? contains : undefined;
}

export async function handleDataInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: DataInteractiveActionKey,
): Promise<void> {
  if (action === "data:convert") {
    await runInteractiveDataConvert(runtime, pathPromptContext);
    return;
  }

  if (action === "data:query") {
    await runInteractiveDataQuery(runtime, pathPromptContext);
    return;
  }

  if (action === "data:preview") {
    const inputPath = await promptRequiredPathWithConfig("Input CSV, TSV, or JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const rowsInput = await input({
      message: "Rows to show (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed > 0 ? true : "Enter a positive integer.";
      },
    });
    const offsetInput = await input({
      message: "Row offset (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed >= 0 ? true : "Enter a non-negative integer.";
      },
    });
    const columnsInput = await input({
      message: "Columns to show (comma-separated, optional)",
      default: "",
    });
    const columns = columnsInput
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const contains = await promptContainsFilters(runtime, inputPath);

    await actionDataPreview(runtime, {
      columns: columns.length > 0 ? columns : undefined,
      contains,
      input: inputPath,
      offset: offsetInput.trim() ? Number(offsetInput) : undefined,
      rows: rowsInput.trim() ? Number(rowsInput) : undefined,
    });
    return;
  }

  if (action === "data:parquet-preview") {
    const inputPath = await promptRequiredPathWithConfig("Input Parquet file", {
      kind: "file",
      ...pathPromptContext,
    });
    const rowsInput = await input({
      message: "Rows to show (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed > 0 ? true : "Enter a positive integer.";
      },
    });
    const offsetInput = await input({
      message: "Row offset (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed >= 0 ? true : "Enter a non-negative integer.";
      },
    });
    const columnsInput = await input({
      message: "Columns to show (comma-separated, optional)",
      default: "",
    });
    const columns = columnsInput
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    await actionDataParquetPreview(runtime, {
      columns: columns.length > 0 ? columns : undefined,
      input: inputPath,
      offset: offsetInput.trim() ? Number(offsetInput) : undefined,
      rows: rowsInput.trim() ? Number(rowsInput) : undefined,
    });
    return;
  }

  if (action === "data:json-to-csv") {
    const inputPath = await promptRequiredPathWithConfig("Input JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".csv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output CSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom CSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionJsonToCsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "data:json-to-tsv") {
    const inputPath = await promptRequiredPathWithConfig("Input JSON file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".tsv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output TSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom TSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionJsonToTsv(runtime, { input: inputPath, output: outputPath, overwrite });
    return;
  }

  if (action === "data:csv-to-json") {
    const inputPath = await promptRequiredPathWithConfig("Input CSV file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".json");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output JSON file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom JSON output path",
    });
    const pretty = await confirm({ message: "Pretty-print JSON?", default: true });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionCsvToJson(runtime, {
      input: inputPath,
      output: outputPath,
      pretty,
      overwrite,
    });
    return;
  }

  if (action === "data:csv-to-tsv") {
    const inputPath = await promptRequiredPathWithConfig("Input CSV file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".tsv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output TSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom TSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionCsvToTsv(runtime, {
      input: inputPath,
      output: outputPath,
      overwrite,
    });
    return;
  }

  if (action === "data:tsv-to-csv") {
    const inputPath = await promptRequiredPathWithConfig("Input TSV file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".csv");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output CSV file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom CSV output path",
    });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionTsvToCsv(runtime, {
      input: inputPath,
      output: outputPath,
      overwrite,
    });
    return;
  }

  if (action === "data:tsv-to-json") {
    const inputPath = await promptRequiredPathWithConfig("Input TSV file", {
      kind: "file",
      ...pathPromptContext,
    });
    const outputHint = formatDefaultOutputPathHint(runtime, inputPath, ".json");
    const outputPath = await promptOptionalOutputPathChoice({
      message: "Output JSON file",
      defaultHint: outputHint,
      kind: "file",
      ...pathPromptContext,
      customMessage: "Custom JSON output path",
    });
    const pretty = await confirm({ message: "Pretty-print JSON?", default: true });
    const overwrite = await confirm({ message: "Overwrite if exists?", default: false });
    await actionTsvToJson(runtime, {
      input: inputPath,
      output: outputPath,
      pretty,
      overwrite,
    });
    return;
  }

  if (action !== "data:csv-to-json") {
    assertNeverInteractiveAction(action);
  }
}
