import { parentPort, workerData } from "node:worker_threads";

import { resolveDocxLimits, type DocxLimits } from "../limits";
import type { DocxReadResult } from "../types";
import { runtimeAsset, runtimeModuleUrl } from "./assets";
import { installOfflineGuard } from "./offline-guard";
import { limitDiagnostic } from "./policy";
import { canonicalizeDocxReadResult } from "./protocol";

async function run(): Promise<void> {
  let result: DocxReadResult;
  try {
    const request = workerData as { bytes: ArrayBuffer; limits: DocxLimits };
    if (!(request.bytes instanceof ArrayBuffer)) throw new Error("docx_protocol_error");
    const limits = resolveDocxLimits(request.limits);
    const guard = installOfflineGuard();
    // A separate fixed asset keeps parser imports after positive interception controls.
    const moduleUrl = runtimeModuleUrl(
      import.meta.url,
      typeof __filename === "string" ? __filename : undefined,
    );
    const parser = (await import(runtimeAsset("docx-parser", moduleUrl).href)) as {
      readDocxDocument(bytes: Buffer, limits: DocxLimits): Promise<DocxReadResult>;
    };
    result = await parser.readDocxDocument(Buffer.from(request.bytes), limits);
    guard.assertNoAttempts();
    result = canonicalizeDocxReadResult(result, limits);
  } catch (error) {
    result = {
      ok: false,
      diagnostic:
        error instanceof Error && error.message === "docx_offline_guard_failed"
          ? "docx_offline_guard_failed"
          : limitDiagnostic(error, "docx_worker_error"),
    };
  }
  parentPort?.postMessage(result);
  parentPort?.close();
}

void run();
