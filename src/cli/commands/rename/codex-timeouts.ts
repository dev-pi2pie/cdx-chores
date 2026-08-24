import { styleCliDiagnosticLabel } from "../../diagnostic-color";
import type { RenameFileOptions } from "../../actions/rename";
import { formatLegacyCodexTimeoutNotice, resolveCodexTimeout } from "../../options/codex-timeout";
import type { LegacyCodexTimeoutMigration } from "../../options/codex-timeout";
import type { CliRuntime } from "../../types";
import type { RenameCodexCommandOptions } from "./codex-options";

interface ResolvedRenameAnalyzerCodexTimeout {
  actionTimeoutMs?: number;
  migration?: LegacyCodexTimeoutMigration;
}

function resolveRenameAnalyzerCodexTimeout(options: {
  scopedTimeoutMs?: number;
  scopedOptionName: string;
  legacyScopedTimeoutMs?: number;
  legacyScopedOptionName: string;
}): ResolvedRenameAnalyzerCodexTimeout {
  const resolved = resolveCodexTimeout({
    scopedTimeoutMs: options.scopedTimeoutMs,
    scopedOptionName: options.scopedOptionName,
    legacyScopedTimeoutMs: options.legacyScopedTimeoutMs,
    legacyScopedOptionName: options.legacyScopedOptionName,
  });
  return {
    actionTimeoutMs: resolved.source === "default" ? undefined : resolved.timeoutMs,
    migration:
      options.legacyScopedTimeoutMs === undefined
        ? undefined
        : {
            legacyOptionName: options.legacyScopedOptionName,
            replacementOptionName: options.scopedOptionName,
            timeoutMs: options.legacyScopedTimeoutMs,
          },
  };
}

function resolveRenameCodexTimeouts(options: RenameCodexCommandOptions): {
  timeouts: Pick<
    RenameFileOptions,
    "codexTimeoutMs" | "codexImagesTimeoutMs" | "codexDocsTimeoutMs"
  >;
  notice?: string;
} {
  const image = resolveRenameAnalyzerCodexTimeout({
    scopedTimeoutMs: options.codexImagesTimeout,
    scopedOptionName: "--codex-images-timeout",
    legacyScopedTimeoutMs: options.codexImagesTimeoutMs,
    legacyScopedOptionName: "--codex-images-timeout-ms",
  });
  const document = resolveRenameAnalyzerCodexTimeout({
    scopedTimeoutMs: options.codexDocsTimeout,
    scopedOptionName: "--codex-docs-timeout",
    legacyScopedTimeoutMs: options.codexDocsTimeoutMs,
    legacyScopedOptionName: "--codex-docs-timeout-ms",
  });
  const migrations = [image.migration, document.migration].filter(
    (migration): migration is LegacyCodexTimeoutMigration => migration !== undefined,
  );

  return {
    timeouts: {
      codexTimeoutMs: options.codexTimeout,
      codexImagesTimeoutMs: image.actionTimeoutMs,
      codexDocsTimeoutMs: document.actionTimeoutMs,
    },
    notice: formatLegacyCodexTimeoutNotice(migrations),
  };
}

export function prepareRenameCodexTimeouts(
  runtime: CliRuntime,
  options: RenameCodexCommandOptions,
): Pick<RenameFileOptions, "codexTimeoutMs" | "codexImagesTimeoutMs" | "codexDocsTimeoutMs"> {
  const resolved = resolveRenameCodexTimeouts(options);
  if (resolved.notice) {
    const warningLabel = "Warning:";
    const notice = resolved.notice.startsWith(warningLabel)
      ? `${styleCliDiagnosticLabel(runtime, runtime.stderr, "warning", warningLabel)}${resolved.notice.slice(warningLabel.length)}`
      : resolved.notice;
    runtime.stderr.write(notice);
  }
  return resolved.timeouts;
}
