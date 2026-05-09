import { confirm } from "@inquirer/prompts";

import {
  collectRenameCleanupAnalyzerEvidence,
  RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS,
  suggestRenameCleanupWithCodex,
  writeRenameCleanupAnalysisCsv,
} from "../../actions";
import { displayPath, printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { createInteractiveAnalyzerStatus } from "../analyzer-status";
import {
  narrowCleanupAnalyzerEvidence,
  printCleanupAnalyzerGroupedReview,
} from "./analyzer-review";
import type { InteractiveCleanupSettings, RenameCleanupScopeOptions } from "./settings-prompts";
import { ANALYZER_FAMILY_VALUES } from "./settings-prompts";
import type { RenameCleanupHint } from "../../actions";

function printCleanupCodexSuggestion(
  runtime: CliRuntime,
  options: InteractiveCleanupSettings & {
    confidence: number;
    reasoningSummary: string;
  },
): void {
  printLine(runtime.stdout, "Codex cleanup suggestion:");
  printLine(runtime.stdout, `- hints: ${options.hints.join(", ")}`);
  printLine(runtime.stdout, `- style: ${options.style}`);
  if (options.timestampAction) {
    printLine(runtime.stdout, `- timestamp action: ${options.timestampAction}`);
  }
  printLine(runtime.stdout, `- confidence: ${Math.round(options.confidence * 100)}%`);
  printLine(runtime.stdout, `- reasoning: ${options.reasoningSummary}`);
  printLine(runtime.stdout);
}

function printDeterministicCleanupSettings(
  runtime: CliRuntime,
  options: InteractiveCleanupSettings,
): void {
  printLine(runtime.stdout, "Deterministic cleanup settings (global):");
  printLine(runtime.stdout, `- hints: ${options.hints.join(", ")}`);
  printLine(runtime.stdout, `- style: ${options.style}`);
  if (options.timestampAction) {
    printLine(runtime.stdout, `- timestamp action: ${options.timestampAction}`);
  }
  printLine(runtime.stdout);
}

export async function promptCleanupSettingsFromSuggestion(
  runtime: CliRuntime,
  options: {
    path: string;
    analyzerFamilies: RenameCleanupHint[];
    scope: RenameCleanupScopeOptions;
  },
): Promise<{
  settings?: InteractiveCleanupSettings;
  analysisReportPath?: string;
}> {
  const status = createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled);

  try {
    printLine(runtime.stdout, `Analyzer families selected: ${options.analyzerFamilies.join(", ")}`);
    printLine(runtime.stdout);

    const analyzerSampleLimit = RENAME_CLEANUP_ANALYZER_EVIDENCE_LIMITS.sampleLimit;

    status.start("Sampling filenames for cleanup analysis...");
    const collectedEvidence = await collectRenameCleanupAnalyzerEvidence(runtime, {
      path: options.path,
      ...options.scope,
      sampleLimit: analyzerSampleLimit,
      // Keep all sample-derived groups available for family narrowing, then let
      // grouped review/prompt rendering apply their own tighter presentation caps.
      groupLimit: analyzerSampleLimit,
      onProgress: (phase) => {
        if (phase === "grouping") {
          status.update("Grouping filename patterns for cleanup analysis...");
        }
      },
    });
    const evidence = narrowCleanupAnalyzerEvidence(
      collectedEvidence,
      options.analyzerFamilies,
      ANALYZER_FAMILY_VALUES,
    );
    status.stop();
    printCleanupAnalyzerGroupedReview(runtime, evidence);
    if (evidence.groupedPatterns.length === 0) {
      printLine(
        runtime.stdout,
        "Codex cleanup suggestion unavailable: No grouped analyzer patterns matched selected families.",
      );
      printLine(runtime.stdout, "Falling back to manual cleanup settings.");
      printLine(runtime.stdout);
      return {};
    }

    status.wait("Waiting for Codex cleanup suggestions...");
    const result = await suggestRenameCleanupWithCodex({
      evidence,
      workingDirectory: runtime.cwd,
    });
    status.stop();

    if (!result.suggestion) {
      if (result.errorMessage) {
        printLine(runtime.stdout, `Codex cleanup suggestion unavailable: ${result.errorMessage}`);
        printLine(runtime.stdout, "Falling back to manual cleanup settings.");
        printLine(runtime.stdout);
      }
      return {};
    }

    printCleanupCodexSuggestion(runtime, {
      hints: result.suggestion.recommendedHints,
      style: result.suggestion.recommendedStyle,
      timestampAction: result.suggestion.recommendedTimestampAction,
      confidence: result.suggestion.confidence,
      reasoningSummary: result.suggestion.reasoningSummary,
    });
    printDeterministicCleanupSettings(runtime, {
      hints: result.suggestion.recommendedHints,
      style: result.suggestion.recommendedStyle,
      timestampAction: result.suggestion.recommendedTimestampAction,
    });

    const writeAnalysisReport = await confirm({
      message: "Write grouped cleanup analysis report CSV?",
      default: false,
    });
    let analysisReportPath: string | undefined;
    if (writeAnalysisReport) {
      analysisReportPath = await writeRenameCleanupAnalysisCsv(runtime, {
        evidence,
        suggestion: result.suggestion,
      });
      printLine(
        runtime.stdout,
        `Wrote cleanup analysis report: ${displayPath(runtime, analysisReportPath)}`,
      );
      printLine(runtime.stdout);
    }

    const useSuggestion = await confirm({
      message: "Use these as deterministic cleanup settings?",
      default: true,
    });
    if (!useSuggestion) {
      return { analysisReportPath };
    }

    return {
      settings: {
        hints: result.suggestion.recommendedHints,
        style: result.suggestion.recommendedStyle,
        timestampAction: result.suggestion.recommendedTimestampAction,
      },
      analysisReportPath,
    };
  } catch (error) {
    status.stop();
    const message = error instanceof Error ? error.message : String(error);
    printLine(runtime.stdout, `Codex cleanup suggestion unavailable: ${message}`);
    printLine(runtime.stdout, "Falling back to manual cleanup settings.");
    printLine(runtime.stdout);
    return {};
  }
}
