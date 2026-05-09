import { join } from "node:path";

import { withNumericSuffix } from "../../../utils/slug";
import { RENAME_TEMPLATE_TOKEN_PATTERN, renderRenameTemplateToken } from "./tokens";

function normalizeRenderedBaseName(value: string, fallback = "file"): string {
  const sanitized = value
    .replace(/[\p{Cc}<>:"/\\|?*]/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/--+/g, "-")
    .replace(/__+/g, "_")
    .replace(/-_+/g, "-")
    .replace(/_-+/g, "-")
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "");
  return sanitized || fallback;
}

export function renderBaseNameFromTemplate(options: {
  template: string;
  prefix: string;
  stem: string;
  mtimeDate: Date;
  serialText?: string;
  uidText?: string;
}): string {
  const rendered = options.template.replace(RENAME_TEMPLATE_TOKEN_PATTERN, (_, rawToken: string) =>
    renderRenameTemplateToken(rawToken.trim(), options),
  );

  return normalizeRenderedBaseName(rendered);
}

export function allocateUniqueRenamePath(options: {
  directoryPath: string;
  baseName: string;
  ext: string;
  occupiedPaths: Set<string>;
}): string {
  let counter = 0;
  while (true) {
    const nextName = `${withNumericSuffix(options.baseName, counter)}${options.ext}`;
    const candidatePath = join(options.directoryPath, nextName);
    if (!options.occupiedPaths.has(candidatePath)) {
      return candidatePath;
    }
    counter += 1;
  }
}
