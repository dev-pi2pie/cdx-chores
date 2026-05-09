import { parseMarkdown } from "../../../markdown";
import { CliError } from "../../errors";
import { readTextFileRequired, writeTextFileSafe } from "../../file-io";
import { defaultOutputPath, resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath, ensureFileExists, printLine } from "../shared";

export interface MdFrontmatterToJsonOptions {
  input: string;
  output?: string;
  overwrite?: boolean;
  pretty?: boolean;
  dataOnly?: boolean;
  toStdout?: boolean;
}

function stringifyJsonOutput(value: unknown, pretty = false): string {
  const spacing = pretty ? 2 : 0;
  return `${JSON.stringify(value, null, spacing)}\n`;
}

export async function actionMdFrontmatterToJson(
  runtime: CliRuntime,
  options: MdFrontmatterToJsonOptions,
): Promise<void> {
  const inputPath = resolveFromCwd(runtime, assertNonEmpty(options.input, "Input path"));
  await ensureFileExists(inputPath, "Input");

  const raw = await readTextFileRequired(inputPath);
  const parsed = parseMarkdown(raw);

  if (parsed.frontmatterType === null || parsed.frontmatter === null) {
    throw new CliError(`No frontmatter found in Markdown file: ${inputPath}`, {
      code: "FRONTMATTER_NOT_FOUND",
      exitCode: 2,
    });
  }

  if (parsed.data === null || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new CliError(`Failed to parse frontmatter as an object in: ${inputPath}`, {
      code: "INVALID_FRONTMATTER",
      exitCode: 2,
    });
  }

  const payload = options.dataOnly
    ? parsed.data
    : {
        frontmatterType: parsed.frontmatterType,
        data: parsed.data,
      };
  const json = stringifyJsonOutput(payload, options.pretty);

  const outputInput = options.output?.trim();
  const writeToStdout = options.toStdout ?? !outputInput;
  if (writeToStdout) {
    runtime.stdout.write(json);
    return;
  }

  const outputPath = resolveFromCwd(
    runtime,
    outputInput || defaultOutputPath(inputPath, ".frontmatter.json"),
  );
  await writeTextFileSafe(outputPath, json, { overwrite: options.overwrite });
  printLine(runtime.stdout, `Wrote JSON: ${displayPath(runtime, outputPath)}`);
}
