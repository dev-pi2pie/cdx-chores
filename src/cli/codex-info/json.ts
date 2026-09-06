import type { CodexInfoReport } from "./report";

/** Preserve JSON values while preventing terminal controls in redirected or TTY output. */
export function serializeCodexInfoReport(report: CodexInfoReport): string {
  return JSON.stringify(report, null, 2).replace(/[\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/gu, (value) => {
    let escaped = "";
    for (let index = 0; index < value.length; index++) {
      escaped += `\\u${value.charCodeAt(index).toString(16).padStart(4, "0")}`;
    }
    return escaped;
  });
}
