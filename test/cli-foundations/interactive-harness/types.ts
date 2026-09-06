import type { DataExtractInteractiveHarnessScenario } from "../../data-extract/interactive/harness-contract";
import type { CodexExecutionOptions } from "../../../src/utils/codex-execution";
import type { DataQueryInteractiveHarnessScenario } from "../../data-query/interactive/harness-contract";
import type { DataSourcesInteractiveHarnessScenario } from "../../data-sources/interactive/harness-contract";
import type {
  DataStackInteractiveHarnessResult,
  DataStackInteractiveHarnessScenario,
} from "../../data-stack/interactive/harness-contract";
import type {
  MarkdownPdfInteractiveHarnessResult,
  MarkdownPdfInteractiveHarnessScenario,
} from "../../markdown-pdf/interactive/harness-contract";
import type { RenameInteractiveHarnessScenario } from "../../rename/interactive/harness-contract";

export interface InteractiveHarnessScenario
  extends
    DataExtractInteractiveHarnessScenario,
    DataQueryInteractiveHarnessScenario,
    DataSourcesInteractiveHarnessScenario,
    DataStackInteractiveHarnessScenario,
    MarkdownPdfInteractiveHarnessScenario,
    RenameInteractiveHarnessScenario {
  mode: "run";
  codexTimeoutMs?: number;
  codexExecution?: CodexExecutionOptions;
  captureCodexExecution?: boolean;
  captureCodexTimeouts?: boolean;
  selectQueue?: unknown[];
  nowIsoString?: string;
  checkboxQueue?: unknown[];
  confirmQueue?: boolean[];
  editorQueue?: string[];
  existingPaths?: string[];
  inputQueue?: string[];
  searchQueue?: Array<string | { term?: string; value: string }>;
  requiredPathQueue?: string[];
  statExistsQueue?: boolean[];
  optionalPathQueue?: Array<string | undefined>;
  stdoutColumns?: number;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
}

export interface InteractiveHarnessResult
  extends DataStackInteractiveHarnessResult, MarkdownPdfInteractiveHarnessResult {
  promptCalls: Array<{
    kind: "select" | "checkbox" | "confirm" | "input" | "editor" | "search";
    message: string;
    defaultValue?: string;
    postfix?: string;
  }>;
  selectChoicesByMessage: Record<
    string,
    Array<{ name: string; value: string; description?: string }>
  >;
  selectDefaultsByMessage: Record<string, string[]>;
  searchChoicesByMessage: Record<
    string,
    Array<{ name: string; value: string; description?: string }>
  >;
  validationCalls: Array<{ kind: "input"; message: string; value: string; error: string }>;
  pathCalls: Array<{
    kind: "required" | "optional" | "hint";
    message?: string;
    options?: Record<string, unknown>;
    inputPath?: string;
    nextExtension?: string;
  }>;
  actionCalls: Array<{ name: string; options: Record<string, unknown> }>;
  removedPaths: string[];
  stdout: string;
  stderr: string;
  error?: string;
}
