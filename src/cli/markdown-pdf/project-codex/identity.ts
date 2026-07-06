import { randomUUID } from "node:crypto";

import { formatUtcFileDateTimeISO } from "../../../utils/datetime";
import type {
  MarkdownPdfProjectCodexIdentity,
  MarkdownPdfProjectCodexIdentityUidFactory,
  MarkdownPdfProjectCodexPlannedIdentity,
} from "./types";

function strictUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function createIdentityUid(
  now: Date,
  attempt: number,
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory,
): string {
  return identityUidFactory ? identityUidFactory(now, attempt) : randomUUID().slice(0, 8);
}

export function createMdPdfProjectCodexIdentityValues(input: {
  now: Date;
  attempt: number;
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory;
}): MarkdownPdfProjectCodexIdentity {
  const timestamp = formatUtcFileDateTimeISO(input.now);
  const uid = createIdentityUid(input.now, input.attempt, input.identityUidFactory);
  return {
    createdAt: strictUtcIso(input.now),
    projectBundleId: `md-pdf-project-${timestamp}-${uid}`,
    profileId: `md-pdf-profile-${timestamp}-${uid}`,
    templateBundleId: `md-pdf-template-${timestamp}-${uid}`,
  };
}

export function createMdPdfProjectCodexIdentity(input: {
  now: Date;
  attempt: number;
  outputDirectory: string;
  identityUidFactory?: MarkdownPdfProjectCodexIdentityUidFactory;
}): MarkdownPdfProjectCodexPlannedIdentity {
  return {
    ...createMdPdfProjectCodexIdentityValues(input),
    outputDirectory: input.outputDirectory,
  };
}
