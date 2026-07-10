import { randomUUID } from "node:crypto";

import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import type { MarkdownPdfTemplateCodexBundleIdFactory } from "./types";

export function createMdPdfTemplateCodexBundleId(
  now: Date,
  attempt: number,
  templateBundleIdFactory?: MarkdownPdfTemplateCodexBundleIdFactory,
): string {
  if (templateBundleIdFactory) {
    return templateBundleIdFactory(now, attempt);
  }
  return `md-pdf-template-${formatUtcFileDateTimeISO(now)}-${randomUUID().slice(0, 8)}`;
}
