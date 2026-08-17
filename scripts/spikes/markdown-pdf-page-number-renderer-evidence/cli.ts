import { resolve } from "node:path";

import { closeRetainedEvidenceLaboratory } from "./laboratory";
import { runRendererEvidence } from "./orchestration";
import { publicEvidenceReport } from "./report";
import { publicSafeText } from "./pdf";

function usage(): string {
  return [
    "Markdown PDF page-number renderer evidence harness.",
    "",
    "Usage:",
    "  bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts run --live [--keep] [--python <executable>] [--node <executable>]",
    "  bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts close --lab <retained-lab>",
    "",
    "The run command performs networked candidate installation and live rendering only with --live.",
  ].join("\n");
}

export async function runRendererEvidenceCli(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }
  if (command === "run") {
    if (!args.includes("--live"))
      throw new Error("Refusing to run the live matrix without --live.");
    const pythonIndex = args.indexOf("--python");
    const pythonExecutable = pythonIndex >= 0 ? args[pythonIndex + 1] : undefined;
    if (pythonIndex >= 0 && !pythonExecutable) throw new Error("--python requires an executable.");
    const nodeIndex = args.indexOf("--node");
    const nodeExecutable = nodeIndex >= 0 ? args[nodeIndex + 1] : undefined;
    if (nodeIndex >= 0 && !nodeExecutable) throw new Error("--node requires an executable.");
    const unknown = args.filter(
      (arg, index) =>
        arg !== "--live" &&
        arg !== "--keep" &&
        arg !== "--python" &&
        arg !== "--node" &&
        index !== pythonIndex + 1 &&
        index !== nodeIndex + 1,
    );
    if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
    const report = await runRendererEvidence({
      keep: args.includes("--keep"),
      pythonExecutable,
      nodeExecutable,
    });
    console.log(JSON.stringify(publicEvidenceReport(report), null, 2));
    if (report.retained) console.error(`Retained laboratory: ${report.labPath}`);
    if (report.outcome !== "passed") process.exitCode = 1;
    return;
  }
  if (command === "close") {
    const labIndex = args.indexOf("--lab");
    const lab = labIndex >= 0 ? args[labIndex + 1] : undefined;
    if (!lab) throw new Error("--lab is required.");
    if (args.length !== 2) throw new Error("Unknown close argument.");
    await closeRetainedEvidenceLaboratory(resolve(lab));
    console.log("Retained renderer-evidence laboratory closed.");
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

export function reportRendererEvidenceCliError(error: unknown): void {
  console.error(publicSafeText(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
