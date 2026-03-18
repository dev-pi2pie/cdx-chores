import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "./cli-test-utils";

export interface InteractiveHarnessScenario {
  mode: "run" | "invalid-data-action";
  selectQueue?: unknown[];
  checkboxQueue?: unknown[];
  confirmQueue?: boolean[];
  editorQueue?: string[];
  existingPaths?: string[];
  inputQueue?: string[];
  requiredPathQueue?: string[];
  optionalPathQueue?: Array<string | undefined>;
  dataExtractActionErrorMessage?: string;
  dataExtractActionErrorCode?: string;
  dataExtractActionStderr?: string;
  dataExtractActionStdout?: string;
  dataQueryActionErrorMessage?: string;
  dataQueryActionErrorCode?: string;
  dataQueryActionStderr?: string;
  dataQueryActionStdout?: string;
  dataQueryCodexDraft?: { reasoningSummary?: string; sql: string };
  dataQueryCodexErrorMessage?: string;
  dataQueryDetectedFormat?: string;
  dataQueryHeaderSuggestionErrorMessage?: string;
  dataQueryHeaderSuggestions?: Array<Record<string, unknown>>;
  dataQueryIntrospection?: Record<string, unknown>;
  dataQueryIntrospectionQueue?: Record<string, unknown>[];
  dataSourceShapeSuggestion?: Record<string, unknown>;
  dataSourceShapeSuggestionErrorMessage?: string;
  dataQuerySources?: string[];
  cleanupAnalyzerEvidence?: Record<string, unknown>;
  cleanupAnalyzerSuggestion?: Record<string, unknown>;
  cleanupAnalyzerErrorMessage?: string;
  cleanupAnalysisReportPath?: string;
  captureCleanupSuggestInput?: boolean;
  captureCleanupCollectInput?: boolean;
  renameApplyErrorMessage?: string;
}

export interface InteractiveHarnessResult {
  promptCalls: Array<{
    kind: "select" | "checkbox" | "confirm" | "input" | "editor";
    message: string;
    defaultValue?: string;
    postfix?: string;
  }>;
  selectChoicesByMessage: Record<string, Array<{ name: string; value: string; description?: string }>>;
  validationCalls: Array<{ kind: "input"; message: string; value: string; error: string }>;
  pathCalls: Array<{
    kind: "required" | "optional" | "hint";
    message?: string;
    options?: Record<string, unknown>;
    inputPath?: string;
    nextExtension?: string;
  }>;
  actionCalls: Array<{ name: string; options: Record<string, unknown> }>;
  stdout: string;
  stderr: string;
  error?: string;
}

const actionsModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/actions/index.ts")).href;
const pathModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/prompts/path.ts")).href;
const pathConfigModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/prompts/path-config.ts"),
).href;
const interactiveIndexUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/interactive/index.ts")).href;
const interactiveDataUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/interactive/data.ts")).href;
const dataQueryCodexModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/data-query/codex.ts")).href;
const dataQueryHeaderMappingModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/duckdb/header-mapping.ts"),
).href;
const duckdbQueryModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/duckdb/query.ts")).href;
const xlsxSourcesModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/duckdb/xlsx-sources.ts")).href;

export function runInteractiveHarness(
  scenario: InteractiveHarnessScenario,
  options: { allowFailure?: boolean } = {},
): InteractiveHarnessResult {
  const childScript = `
    import { mock } from "bun:test";
    import { dirname, resolve as resolvePath } from "node:path";

    const scenario = ${JSON.stringify(scenario)};
    const promptCalls = [];
    const selectChoicesByMessage = {};
    const validationCalls = [];
    const pathCalls = [];
    const actionCalls = [];
    const mockedPathPromptRuntimeConfig = {
      mode: "auto",
      autocomplete: {
        enabled: true,
        minChars: 1,
        maxSuggestions: 12,
        includeHidden: false,
      },
    };

    function shiftQueueValue(queue, label) {
      if (queue.length === 0) {
        throw new Error(\`Missing queued value for \${label}\`);
      }
      return queue.shift();
    }

    function resolveHarnessPath(inputPath) {
      return resolvePath(process.cwd(), String(inputPath ?? ""));
    }

    function directoryPathForFile(inputPath) {
      return dirname(resolveHarnessPath(inputPath));
    }

    mock.module("@inquirer/prompts", () => ({
      select: async (options) => {
        const choices = (options.choices ?? []).map((choice) => ({
          name: String(choice.name ?? ""),
          value: String(choice.value ?? ""),
          description: choice.description ? String(choice.description) : undefined,
        }));
        promptCalls.push({
          kind: "select",
          message: options.message,
        });
        selectChoicesByMessage[String(options.message ?? "")] = choices;
        return shiftQueueValue(scenario.selectQueue ?? [], \`select:\${options.message}\`);
      },
      checkbox: async (options) => {
        promptCalls.push({ kind: "checkbox", message: options.message });
        return shiftQueueValue(scenario.checkboxQueue ?? [], \`checkbox:\${options.message}\`);
      },
      confirm: async (options) => {
        promptCalls.push({
          kind: "confirm",
          message: options.message,
        });
        return shiftQueueValue(scenario.confirmQueue ?? [], \`confirm:\${options.message}\`);
      },
      input: async (options) => {
        promptCalls.push({
          kind: "input",
          message: options.message,
          defaultValue: typeof options.default === "string" ? options.default : undefined,
        });
        while (true) {
          const nextValue = shiftQueueValue(scenario.inputQueue ?? [], \`input:\${options.message}\`);
          if (!options.validate) {
            return nextValue;
          }
          const validation = await options.validate(nextValue);
          if (validation === true) {
            return nextValue;
          }
          validationCalls.push({
            kind: "input",
            message: options.message,
            value: String(nextValue ?? ""),
            error: String(validation),
          });
        }
      },
      editor: async (options) => {
        promptCalls.push({
          kind: "editor",
          message: options.message,
          defaultValue: typeof options.default === "string" ? options.default : undefined,
          postfix: typeof options.postfix === "string" ? options.postfix : undefined,
        });
        while (true) {
          const nextValue = shiftQueueValue(scenario.editorQueue ?? [], \`editor:\${options.message}\`);
          if (!options.validate) {
            return nextValue;
          }
          const validation = await options.validate(nextValue);
          if (validation === true) {
            return nextValue;
          }
          validationCalls.push({
            kind: "input",
            message: options.message,
            value: String(nextValue ?? ""),
            error: String(validation),
          });
        }
      },
    }));

    mock.module("node:fs/promises", () => ({
      rm: async (path, options) => {
        actionCalls.push({ name: "fs:rm", options: { path: String(path), options } });
        return undefined;
      },
      stat: async (path) => {
        const existingPaths = new Set((scenario.existingPaths ?? []).map((item) => resolveHarnessPath(item)));
        const normalizedPath = resolveHarnessPath(String(path ?? ""));
        if (existingPaths.has(normalizedPath)) {
          return {
            isFile: () => true,
          };
        }
        throw new Error("ENOENT");
      },
    }));

    mock.module(${JSON.stringify(actionsModuleUrl)}, () => ({
      RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS: {
        sampleLimit: 40,
        groupLimit: 12,
        examplesPerGroup: 3,
      },
      actionDoctor: async (_runtime, options) => {
        actionCalls.push({ name: "doctor", options });
      },
      actionDataPreview: async (_runtime, options) => {
        actionCalls.push({ name: "data:preview", options });
      },
      actionDataParquetPreview: async (_runtime, options) => {
        actionCalls.push({ name: "data:parquet-preview", options });
      },
      actionDataExtract: async (_runtime, options) => {
        actionCalls.push({ name: "data:extract", options });
        if (typeof scenario.dataExtractActionStdout === "string") {
          _runtime.stdout.write(scenario.dataExtractActionStdout);
        }
        if (typeof scenario.dataExtractActionStderr === "string") {
          _runtime.stderr.write(scenario.dataExtractActionStderr);
        }
        const existingPaths = new Set((scenario.existingPaths ?? []).map((item) => resolveHarnessPath(item)));
        const outputPath =
          typeof options.output === "string" && options.output.length > 0
            ? resolveHarnessPath(options.output)
            : undefined;
        if (outputPath && existingPaths.has(outputPath) && !options.overwrite) {
          const error = new Error(\`Output file already exists: \${outputPath}. Use --overwrite to replace it.\`);
          error.code = "OUTPUT_EXISTS";
          throw error;
        }
        if (scenario.dataExtractActionErrorMessage) {
          const error = new Error(scenario.dataExtractActionErrorMessage);
          error.code = scenario.dataExtractActionErrorCode ?? "DATA_EXTRACT_FAILED";
          throw error;
        }
      },
      actionDataQuery: async (_runtime, options) => {
        actionCalls.push({ name: "data:query", options });
        if (typeof scenario.dataQueryActionStdout === "string") {
          _runtime.stdout.write(scenario.dataQueryActionStdout);
        }
        if (typeof scenario.dataQueryActionStderr === "string") {
          _runtime.stderr.write(scenario.dataQueryActionStderr);
        }
        const existingPaths = new Set((scenario.existingPaths ?? []).map((item) => resolveHarnessPath(item)));
        const outputPath =
          typeof options.output === "string" && options.output.length > 0
            ? resolveHarnessPath(options.output)
            : undefined;
        if (outputPath && existingPaths.has(outputPath) && !options.overwrite) {
          const error = new Error(\`Output file already exists: \${outputPath}. Use --overwrite to replace it.\`);
          error.code = "OUTPUT_EXISTS";
          throw error;
        }
        if (scenario.dataQueryActionErrorMessage) {
          const error = new Error(scenario.dataQueryActionErrorMessage);
          error.code = scenario.dataQueryActionErrorCode ?? "DATA_QUERY_FAILED";
          throw error;
        }
      },
      loadDataPreviewSource: async (_runtime, input) => ({
        inputPath: String(input ?? ""),
        source: {
          columns: ["id", "name", "status", "region", "meta:key", "path"],
          format:
            String(input ?? "").endsWith(".json")
              ? "json"
              : String(input ?? "").endsWith(".tsv")
                ? "tsv"
                : "csv",
          totalRows: 3,
          getWindow: () => [],
        },
      }),
      actionJsonToCsv: async (_runtime, options) => {
        actionCalls.push({ name: "data:json-to-csv", options });
      },
      actionJsonToTsv: async (_runtime, options) => {
        actionCalls.push({ name: "data:json-to-tsv", options });
      },
      actionCsvToJson: async (_runtime, options) => {
        actionCalls.push({ name: "data:csv-to-json", options });
      },
      actionCsvToTsv: async (_runtime, options) => {
        actionCalls.push({ name: "data:csv-to-tsv", options });
      },
      actionTsvToCsv: async (_runtime, options) => {
        actionCalls.push({ name: "data:tsv-to-csv", options });
      },
      actionTsvToJson: async (_runtime, options) => {
        actionCalls.push({ name: "data:tsv-to-json", options });
      },
      actionMdToDocx: async (_runtime, options) => {
        actionCalls.push({ name: "md:to-docx", options });
      },
      actionMdFrontmatterToJson: async (_runtime, options) => {
        actionCalls.push({ name: "md:frontmatter-to-json", options });
      },
      actionRenameBatch: async (_runtime, options) => {
        actionCalls.push({ name: "rename:batch", options });
        return {
          changedCount: 0,
          totalCount: 0,
          directoryPath: String(options.directory ?? ""),
        };
      },
      actionRenameFile: async (_runtime, options) => {
        actionCalls.push({ name: "rename:file", options });
        return {
          changed: false,
          filePath: resolveHarnessPath(options.path),
          directoryPath: directoryPathForFile(options.path),
        };
      },
      actionRenameApply: async (_runtime, options) => {
        actionCalls.push({ name: "rename:apply", options });
        if (scenario.renameApplyErrorMessage) {
          throw new Error(scenario.renameApplyErrorMessage);
        }
        return {
          csvPath: String(options.csv ?? ""),
          appliedCount: 1,
          totalRows: 1,
          skippedCount: 0,
        };
      },
      actionRenameCleanup: async (_runtime, options) => {
        actionCalls.push({ name: "rename:cleanup", options });
        if (String(options.path ?? "") === "docs") {
          return {
            kind: "directory",
            changedCount: 2,
            totalCount: 3,
            directoryPath: resolveHarnessPath("docs"),
            planCsvPath: "plans/cleanup.csv",
          };
        }
        return {
          kind: "file",
          changed: false,
          filePath: resolveHarnessPath(options.path),
          directoryPath: directoryPathForFile(options.path),
        };
      },
      resolveRenameCleanupTarget: async (_runtime, inputPath) => {
        if (String(inputPath) === "docs") {
          return { kind: "directory", path: "docs" };
        }
        return { kind: "file", path: String(inputPath ?? "") };
      },
      collectRenameCleanupAnalyzerEvidence: async (_runtime, options) => {
        if (scenario.captureCleanupCollectInput) {
          actionCalls.push({
            name: "rename:cleanup:collect-evidence",
            options: {
              path: options.path,
              recursive: options.recursive,
              maxDepth: options.maxDepth,
              matchRegex: options.matchRegex,
              skipRegex: options.skipRegex,
              ext: options.ext,
              skipExt: options.skipExt,
              sampleLimit: options.sampleLimit,
              groupLimit: options.groupLimit,
              examplesPerGroup: options.examplesPerGroup,
            },
          });
        }
        options.onProgress?.("sampling");
        if (scenario.cleanupAnalyzerEvidence) {
          options.onProgress?.("grouping");
          return scenario.cleanupAnalyzerEvidence;
        }
        const inputPath = String(options.path ?? "");
        if (inputPath === "docs") {
          options.onProgress?.("grouping");
          return {
            targetKind: "directory",
            targetPath: "docs",
            totalCandidateCount: 3,
            sampledCount: 3,
            sampleNames: ["app-00001.log", "app-00002.log", "app-00003.log"],
            groupedPatterns: [
              {
                pattern: "app-{serial}.log",
                count: 3,
                examples: ["app-00001.log", "app-00002.log", "app-00003.log"],
              },
            ],
          };
        }
        options.onProgress?.("grouping");
        return {
          targetKind: "file",
          targetPath: inputPath,
          totalCandidateCount: 1,
          sampledCount: 1,
          sampleNames: [inputPath],
          groupedPatterns: [
            {
              pattern: "file.txt",
              count: 1,
              examples: [inputPath],
            },
          ],
        };
      },
      suggestRenameCleanupWithCodex: async (options) => {
        if (scenario.captureCleanupSuggestInput) {
          actionCalls.push({
            name: "rename:cleanup:codex-suggest",
            options: {
              targetKind: options.evidence?.targetKind,
              totalCandidateCount: options.evidence?.totalCandidateCount,
              sampledCount: options.evidence?.sampledCount,
              sampleNames: options.evidence?.sampleNames,
              groupedPatterns: Array.isArray(options.evidence?.groupedPatterns)
                ? options.evidence.groupedPatterns.map((group) => ({
                    pattern: group.pattern,
                    count: group.count,
                    examples: group.examples,
                  }))
                : [],
            },
          });
        }
        if (scenario.cleanupAnalyzerErrorMessage) {
          return { errorMessage: scenario.cleanupAnalyzerErrorMessage };
        }
        return {
          suggestion:
            scenario.cleanupAnalyzerSuggestion ?? {
              recommendedHints: ["serial"],
              recommendedStyle: "slug",
              confidence: 0.86,
              reasoningSummary: "Most sampled names differ only by trailing counters.",
            },
        };
      },
      writeRenameCleanupAnalysisCsv: async () => {
        const csvPath = scenario.cleanupAnalysisReportPath ?? "reports/cleanup-analysis.csv";
        actionCalls.push({ name: "rename:cleanup:analysis-report", options: { csvPath } });
        return csvPath;
      },
      actionVideoConvert: async (_runtime, options) => {
        actionCalls.push({ name: "video:convert", options });
      },
      actionVideoResize: async (_runtime, options) => {
        actionCalls.push({ name: "video:resize", options });
      },
      actionVideoGif: async (_runtime, options) => {
        actionCalls.push({ name: "video:gif", options });
      },
    }));

    mock.module(${JSON.stringify(pathModuleUrl)}, () => ({
      formatDefaultOutputPathHint: (_runtime, inputPath, nextExtension) => {
        pathCalls.push({ kind: "hint", inputPath, nextExtension });
        return \`\${inputPath}\${nextExtension}\`;
      },
      promptOptionalOutputPathChoice: async (options) => {
        pathCalls.push({ kind: "optional", message: options.message, options });
        return shiftQueueValue(scenario.optionalPathQueue ?? [], \`optional:\${options.message}\`);
      },
      promptRequiredPathWithConfig: async (message, options) => {
        pathCalls.push({ kind: "required", message, options });
        return shiftQueueValue(scenario.requiredPathQueue ?? [], \`required:\${message}\`);
      },
    }));

    mock.module(${JSON.stringify(duckdbQueryModuleUrl)}, () => ({
      DATA_QUERY_INPUT_FORMAT_VALUES: ["csv", "tsv", "parquet", "sqlite", "excel"],
      normalizeExcelHeaderRow: (value) => {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error("--header-row must be a positive integer.");
        }
        return parsed;
      },
      normalizeExcelRange: (value) => String(value ?? "").trim().toUpperCase(),
      quoteSqlIdentifier: (value) => \`"\${String(value).replaceAll('"', '""')}"\`,
      createDuckDbConnection: async () => ({
        closeSync() {},
      }),
      detectDataQueryInputFormat: () => scenario.dataQueryDetectedFormat ?? "csv",
      listDataQuerySources: async () => scenario.dataQuerySources,
      collectDataQuerySourceIntrospection: async (_connection, _input, _format, shape) =>
        (scenario.dataQueryIntrospectionQueue ?? []).shift() ?? scenario.dataQueryIntrospection ?? {
          columns: [
            { name: "id", type: "BIGINT" },
            { name: "name", type: "VARCHAR" },
            { name: "status", type: "VARCHAR" },
          ],
          sampleRows: [
            { id: "1", name: "Ada", status: "active" },
            { id: "2", name: "Bob", status: "inactive" },
          ],
          selectedHeaderRow: shape?.headerRow,
          selectedRange: shape?.range,
          selectedSource: shape?.source,
          truncated: false,
        },
    }));

    mock.module(${JSON.stringify(xlsxSourcesModuleUrl)}, () => ({
      collectXlsxSheetSnapshot: async (_inputPath, sheetName) => ({
        mergedRanges: [],
        mergedRangesTruncated: false,
        nonEmptyCellCount: 6,
        nonEmptyRowCount: 3,
        rows: [
          {
            rowNumber: 1,
            cellCount: 2,
            firstRef: "A1",
            lastRef: "B1",
            cells: [
              { ref: "A1", value: "id" },
              { ref: "B1", value: "name" },
            ],
          },
          {
            rowNumber: 2,
            cellCount: 2,
            firstRef: "A2",
            lastRef: "B2",
            cells: [
              { ref: "A2", value: "1" },
              { ref: "B2", value: "Ada" },
            ],
          },
        ],
        rowsTruncated: false,
        sheetName: String(sheetName ?? "Summary"),
        usedRange: "A1:B3",
      }),
    }));

    mock.module(${JSON.stringify(dataQueryCodexModuleUrl)}, () => ({
      normalizeDataQueryCodexIntent: (value) =>
        String(value ?? "")
          .split(/\\r?\\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join(" ")
          .trim(),
      normalizeDataQueryCodexEditorIntent: (value) =>
        String(value ?? "")
          .split(/\\r?\\n/)
          .filter((line) => !line.trimStart().startsWith("#"))
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join(" ")
          .trim(),
      buildDataQueryCodexIntentEditorTemplate: (options) => {
        const schema = Array.isArray(options.introspection?.columns) && options.introspection.columns.length > 0
          ? options.introspection.columns
              .slice(0, 8)
              .map((column) => \`\${column.name} (\${column.type})\`)
              .join(", ")
          : "(no columns available)";
        const sampleRows = Array.isArray(options.introspection?.sampleRows)
          ? options.introspection.sampleRows.slice(0, 3)
          : [];

        return [
          "# Query context for Codex drafting.",
          "# Logical table: file",
          \`# Format: \${options.format}\`,
          ...(options.introspection?.selectedSource ? [\`# Source: \${options.introspection.selectedSource}\`] : []),
          ...(options.introspection?.selectedRange ? [\`# Range: \${options.introspection.selectedRange}\`] : []),
          ...(options.introspection?.selectedHeaderRow !== undefined
            ? [\`# Header row: \${options.introspection.selectedHeaderRow}\`]
            : []),
          \`# Schema: \${schema}\`,
          "# Sample rows:",
          ...(sampleRows.length > 0
            ? sampleRows.map((row, index) => \`# \${index + 1}. \${JSON.stringify(row)}\`)
            : ["# (no sample rows available)"]),
          "#",
          "# Write plain intent below. Comment lines starting with # are ignored.",
          "",
          String(options.intent ?? "").trim(),
        ].join("\\n");
      },
      draftDataQueryWithCodex: async (options) => {
        actionCalls.push({
          name: "data:query:codex-draft",
          options: {
            format: options.format,
            intent: options.intent,
            ...(options.introspection?.selectedHeaderRow !== undefined
              ? { selectedHeaderRow: options.introspection.selectedHeaderRow }
              : {}),
            ...(options.introspection?.selectedRange
              ? { selectedRange: options.introspection.selectedRange }
              : {}),
            selectedSource: options.introspection?.selectedSource,
          },
        });
        if (scenario.dataQueryCodexErrorMessage) {
          return { errorMessage: scenario.dataQueryCodexErrorMessage };
        }
        return {
          draft:
            scenario.dataQueryCodexDraft ?? {
              sql: "select count(*) as total from file",
              reasoningSummary: "Counts rows from the selected source.",
            },
        };
      },
    }));

    mock.module(${JSON.stringify(dataQueryHeaderMappingModuleUrl)}, () => ({
      normalizeHeaderMappingTargetName: (value) =>
        String(value ?? "")
          .trim()
          .replace(/[^A-Za-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .replace(/_+/g, "_")
          .toLowerCase(),
      normalizeAndValidateAcceptedHeaderMappings: ({ availableColumns, mappings }) => {
        return (mappings ?? [])
          .map((mapping) => ({
            ...mapping,
            from: String(mapping.from ?? "").trim() || String((availableColumns ?? [])[0] ?? "column_1"),
            to: String(mapping.to ?? "").trim() || "edited_header",
          }))
          .filter((mapping) => mapping.to !== mapping.from);
      },
      suggestDataHeaderMappingsWithCodex: async (options) => {
        actionCalls.push({
          name: "data:query:header-suggest",
          options: {
            format: options.format,
            ...(options.introspection?.selectedHeaderRow !== undefined
              ? { selectedHeaderRow: options.introspection.selectedHeaderRow }
              : {}),
            ...(options.introspection?.selectedRange
              ? { selectedRange: options.introspection.selectedRange }
              : {}),
            selectedSource: options.introspection?.selectedSource,
          },
        });
        if (scenario.dataQueryHeaderSuggestionErrorMessage) {
          return { errorMessage: scenario.dataQueryHeaderSuggestionErrorMessage, mappings: [] };
        }
        return {
          mappings:
            scenario.dataQueryHeaderSuggestions ?? [
              { from: "column_1", to: "id", sample: "1", inferredType: "BIGINT" },
              { from: "column_2", to: "name", sample: "Ada", inferredType: "VARCHAR" },
            ],
        };
      },
    }));

    mock.module(${JSON.stringify(pathToFileURL(resolve(REPO_ROOT, "src/cli/duckdb/source-shape.ts")).href)}, () => ({
      suggestDataSourceShapeWithCodex: async (options) => {
        actionCalls.push({
          name: "data:source-shape-suggest",
          options: {
            ...(options.currentHeaderRow !== undefined
              ? { currentHeaderRow: options.currentHeaderRow }
              : {}),
            ...(options.currentRange
              ? { currentRange: options.currentRange }
              : {}),
            selectedSource: options.context?.currentIntrospection?.selectedSource,
            sheetName: options.context?.sheetSnapshot?.sheetName,
          },
        });
        if (scenario.dataSourceShapeSuggestionErrorMessage) {
          return { errorMessage: scenario.dataSourceShapeSuggestionErrorMessage };
        }
        return scenario.dataSourceShapeSuggestion ?? {
          reasoningSummary: "The table starts at A1 and spans two columns.",
          shape: {
            range: "A1:B3",
          },
        };
      },
    }));

    mock.module(${JSON.stringify(pathConfigModuleUrl)}, () => ({
      resolvePathPromptRuntimeConfig: () => mockedPathPromptRuntimeConfig,
    }));

    class CaptureStream {
      text = "";

      write(chunk) {
        this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        return true;
      }
    }

    const stdout = new CaptureStream();
    const stderr = new CaptureStream();
    const runtime = {
      cwd: process.cwd(),
      colorEnabled: true,
      now: () => new Date("2026-02-25T00:00:00.000Z"),
      platform: process.platform,
      stdout,
      stderr,
      stdin: process.stdin,
      displayPathStyle: "relative",
    };

    try {
      if (scenario.mode === "run") {
        const { runInteractiveMode } = await import(${JSON.stringify(interactiveIndexUrl)});
        await runInteractiveMode(runtime);
      } else {
        const { handleDataInteractiveAction } = await import(${JSON.stringify(interactiveDataUrl)});
        await handleDataInteractiveAction(
          runtime,
          {
            runtimeConfig: mockedPathPromptRuntimeConfig,
            cwd: runtime.cwd,
            stdin: runtime.stdin,
            stdout: runtime.stdout,
          },
          "data:unknown",
        );
      }

      console.log(
        JSON.stringify({
          promptCalls,
          selectChoicesByMessage,
          validationCalls,
          pathCalls,
          actionCalls,
          stdout: stdout.text,
          stderr: stderr.text,
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          promptCalls,
          selectChoicesByMessage,
          validationCalls,
          pathCalls,
          actionCalls,
          stdout: stdout.text,
          stderr: stderr.text,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exitCode = 1;
    }
  `;

  const proc = Bun.spawnSync({
    cmd: [process.execPath, "-e", childScript],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = Buffer.from(proc.stdout).toString("utf8").trim();
  const stderr = Buffer.from(proc.stderr).toString("utf8");

  if (!stdout) {
    throw new Error(`Interactive harness produced no stdout.\n${stderr}`);
  }

  const parsed = JSON.parse(stdout) as InteractiveHarnessResult;
  if (proc.exitCode !== 0 && !(options.allowFailure ?? false)) {
    throw new Error(`Interactive harness failed: ${parsed.error ?? stderr}`);
  }

  return parsed;
}
