import { stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import pc from "picocolors";

import { csvRowsToObjects, parseCsv, stringifyCsv } from "../utils/csv";
import { inspectCommand, requireCommandAvailable } from "./deps";
import { CliError } from "./errors";
import {
  applyPlannedRenames,
  defaultOutputPath,
  planBatchRename,
  readTextFileRequired,
  resolveFromCwd,
  writeTextFileSafe,
} from "./fs-utils";
import { execCommand } from "./process";
import type { CliRuntime, PlannedRename } from "./types";

function printLine(stream: NodeJS.WritableStream, line = ""): void {
  stream.write(`${line}\n`);
}

function assertNonEmpty(value: string | undefined, label: string): string {
  const next = value?.trim() ?? "";
  if (!next) {
    throw new CliError(`${label} is required.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return next;
}

async function ensureFileExists(path: string, label: string): Promise<void> {
  try {
    const fileStats = await stat(path);
    if (!fileStats.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new CliError(`${label} file not found: ${path}`, {
      code: "FILE_NOT_FOUND",
      exitCode: 2,
    });
  }
}

export interface DoctorOptions {
  json?: boolean;
}

export async function actionDoctor(runtime: CliRuntime, options: DoctorOptions = {}): Promise<void> {
  const [pandoc, ffmpeg] = await Promise.all([
    inspectCommand("pandoc", runtime.platform),
    inspectCommand("ffmpeg", runtime.platform),
  ]);

  const capabilities = {
    "md.to-docx": pandoc.available,
    "video.convert": ffmpeg.available,
    "video.resize": ffmpeg.available,
    "video.gif": ffmpeg.available,
  };

  if (options.json) {
    const payload = {
      generatedAt: runtime.now().toISOString(),
      platform: runtime.platform,
      nodeVersion: process.version,
      tools: { pandoc, ffmpeg },
      capabilities,
    };
    printLine(runtime.stdout, JSON.stringify(payload, null, 2));
    return;
  }

  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores doctor")));
  printLine(runtime.stdout, `${pc.dim("Platform:")} ${pc.white(runtime.platform)}`);
  printLine(runtime.stdout, `${pc.dim("Node.js:")} ${pc.white(process.version)}`);
  printLine(runtime.stdout);

  for (const item of [pandoc, ffmpeg]) {
    const statusText = item.available
      ? pc.green(`available (${item.version ?? "unknown version"})`)
      : pc.red("missing");
    printLine(
      runtime.stdout,
      `- ${pc.bold(item.name)}: ${statusText}`,
    );
    if (!item.available) {
      printLine(runtime.stdout, `  ${pc.yellow("Install suggestion:")} ${item.installHint}`);
    }
  }

  printLine(runtime.stdout);
  printLine(runtime.stdout, pc.bold(pc.cyan("Capabilities:")));
  for (const [capability, available] of Object.entries(capabilities)) {
    printLine(
      runtime.stdout,
      `- ${pc.bold(capability)}: ${available ? pc.green("available") : pc.red("unavailable")}`,
    );
  }
}

function normalizeRowsFromJson(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return [];
    }
    if (input.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
      return input as Array<Record<string, unknown>>;
    }
    return input.map((item) => ({ value: item }));
  }

  if (input !== null && typeof input === "object") {
    return [input as Record<string, unknown>];
  }

  return [{ value: input }];
}

export interface JsonToCsvOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export async function actionJsonToCsv(runtime: CliRuntime, options: JsonToCsvOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".csv"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid JSON: ${message}`, { code: "INVALID_JSON", exitCode: 2 });
  }

  const rows = normalizeRowsFromJson(parsed);
  const csv = stringifyCsv(rows);
  await writeTextFileSafe(outputPath, csv, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote CSV: ${outputPath}`);
  printLine(runtime.stdout, `Rows: ${rows.length}`);
}

export interface CsvToJsonOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
}

export async function actionCsvToJson(runtime: CliRuntime, options: CsvToJsonOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".json"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const rows = parseCsv(raw);
  const records = csvRowsToObjects(rows);
  const json = `${JSON.stringify(records, null, options.pretty ? 2 : 0)}\n`;
  await writeTextFileSafe(outputPath, json, { overwrite: options.overwrite });

  printLine(runtime.stdout, `Wrote JSON: ${outputPath}`);
  printLine(runtime.stdout, `Rows: ${records.length}`);
}

export interface MdToDocxOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
}

export async function actionMdToDocx(runtime: CliRuntime, options: MdToDocxOptions): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolveFromCwd(runtime, options.output?.trim() || defaultOutputPath(inputPath, ".docx"));
  await ensureFileExists(inputPath, "Input");
  await requireCommandAvailable("pandoc", runtime.platform);

  if (!options.overwrite) {
    try {
      await stat(outputPath);
      throw new CliError(`Output file already exists: ${outputPath}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
    }
  }

  const args = [inputPath, "-o", outputPath];
  const result = await execCommand("pandoc", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(`pandoc failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(), {
      code: "PROCESS_FAILED",
      exitCode: 1,
    });
  }

  printLine(runtime.stdout, `Wrote DOCX: ${outputPath}`);
}

function formatRenamePreviewLine(plan: PlannedRename): string {
  const fromName = basename(plan.fromPath);
  const toName = basename(plan.toPath);
  return plan.changed ? `- ${fromName} -> ${toName}` : `- ${fromName} (unchanged)`;
}

export interface RenameBatchOptions {
  directory: string;
  prefix?: string;
  dryRun?: boolean;
}

export async function actionRenameBatch(
  runtime: CliRuntime,
  options: RenameBatchOptions,
): Promise<{ changedCount: number; totalCount: number; directoryPath: string }> {
  const directory = assertNonEmpty(options.directory, "Directory path");
  const { directoryPath, plans } = await planBatchRename(runtime, directory, {
    prefix: options.prefix,
    now: runtime.now(),
  });

  const totalCount = plans.length;
  const changedCount = plans.filter((plan) => plan.changed).length;

  printLine(runtime.stdout, `Directory: ${directoryPath}`);
  printLine(runtime.stdout, `Files found: ${totalCount}`);
  printLine(runtime.stdout, `Files to rename: ${changedCount}`);
  printLine(runtime.stdout);

  for (const plan of plans) {
    printLine(runtime.stdout, formatRenamePreviewLine(plan));
  }

  if (options.dryRun ?? false) {
    printLine(runtime.stdout);
    printLine(runtime.stdout, "Dry run only. No files were renamed.");
    return { changedCount, totalCount, directoryPath };
  }

  await applyPlannedRenames(plans);
  printLine(runtime.stdout);
  printLine(runtime.stdout, `Renamed ${changedCount} file(s).`);

  return { changedCount, totalCount, directoryPath };
}

export interface VideoConvertOptions {
  input: string;
  output: string;
  overwrite?: boolean;
}

export interface VideoResizeOptions {
  input: string;
  output: string;
  width: number;
  height: number;
  overwrite?: boolean;
}

export interface VideoGifOptions {
  input: string;
  output?: string;
  width?: number;
  fps?: number;
  overwrite?: boolean;
}

async function runFfmpeg(runtime: CliRuntime, args: string[]): Promise<void> {
  await requireCommandAvailable("ffmpeg", runtime.platform);
  const result = await execCommand("ffmpeg", args, { cwd: runtime.cwd });
  if (!result.ok) {
    throw new CliError(`ffmpeg failed (${result.code ?? "unknown"}): ${result.stderr || result.stdout}`.trim(), {
      code: "PROCESS_FAILED",
      exitCode: 1,
    });
  }
}

export async function actionVideoConvert(runtime: CliRuntime, options: VideoConvertOptions): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(runtime.cwd, assertNonEmpty(options.output, "Output path"));
  await ensureFileExists(inputPath, "Input");

  const args = [options.overwrite ? "-y" : "-n", "-i", inputPath, outputPath];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote video: ${outputPath}`);
}

export async function actionVideoResize(runtime: CliRuntime, options: VideoResizeOptions): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(runtime.cwd, assertNonEmpty(options.output, "Output path"));
  if (!Number.isFinite(options.width) || options.width <= 0) {
    throw new CliError("Width must be a positive number.", { code: "INVALID_INPUT", exitCode: 2 });
  }
  if (!Number.isFinite(options.height) || options.height <= 0) {
    throw new CliError("Height must be a positive number.", { code: "INVALID_INPUT", exitCode: 2 });
  }
  await ensureFileExists(inputPath, "Input");

  const args = [
    options.overwrite ? "-y" : "-n",
    "-i",
    inputPath,
    "-vf",
    `scale=${Math.trunc(options.width)}:${Math.trunc(options.height)}`,
    outputPath,
  ];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote resized video: ${outputPath}`);
}

export async function actionVideoGif(runtime: CliRuntime, options: VideoGifOptions): Promise<void> {
  const inputPath = resolve(runtime.cwd, assertNonEmpty(options.input, "Input path"));
  const outputPath = resolve(
    runtime.cwd,
    options.output?.trim() || defaultOutputPath(inputPath, ".gif"),
  );
  await ensureFileExists(inputPath, "Input");

  const fps = Number.isFinite(options.fps) && (options.fps ?? 0) > 0 ? Math.trunc(options.fps!) : 10;
  const width = Number.isFinite(options.width) && (options.width ?? 0) > 0 ? Math.trunc(options.width!) : 480;

  const args = [
    options.overwrite ? "-y" : "-n",
    "-i",
    inputPath,
    "-vf",
    `fps=${fps},scale=${width}:-1:flags=lanczos`,
    outputPath,
  ];
  await runFfmpeg(runtime, args);
  printLine(runtime.stdout, `Wrote GIF: ${outputPath}`);
}

export async function actionDeferred(runtime: CliRuntime, label: string): Promise<void> {
  throw new CliError(`${label} is not implemented in the initial launch phase yet.`, {
    code: "DEFERRED_FEATURE",
    exitCode: 2,
  });
}
