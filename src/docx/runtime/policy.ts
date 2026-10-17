import type { DocxLimits } from "../limits";

/** Child/worker configuration never inherits loaders, credentials, proxies, or PATH. */
export function minimalDocxEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { NO_COLOR: "1" };
  for (const key of ["SystemRoot", "SYSTEMROOT", "TMPDIR", "TMP", "TEMP"]) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

export function rssExceeded(observed: number, limit: number): boolean {
  return !Number.isFinite(observed) || observed < 0 || observed > limit;
}

export function limitDiagnostic(error: unknown, fallback = "docx_protocol_error"): string {
  return error instanceof Error && /^docx_limit:[A-Za-z]+$/.test(error.message)
    ? error.message
    : fallback;
}

export function remainingDeadline(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}

export function requestMetadata(limits: DocxLimits): Buffer {
  return Buffer.from(JSON.stringify(limits), "utf8");
}
