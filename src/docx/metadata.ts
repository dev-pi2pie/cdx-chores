import { readDocxCoreMetadataFromParts } from "../adapters/docx/ooxml-metadata";
import { resolveDocxMetadataPartPaths } from "../adapters/docx/ooxml-part-discovery";
import type { GuardedDocxPackage } from "./package";
import type { XmlBudget } from "./xml-budget";

export async function readMetadata(archive: GuardedDocxPackage, budget: XmlBudget) {
  // Preserve the existing metadata eligibility when content limits are raised.
  const parts = new Map<string, string>();
  for (const path of archive.metadataEntries.keys()) parts.set(path, "");
  async function read(path: string): Promise<void> {
    if (!parts.has(path)) return;
    const text = await archive.readMetadataText(path);
    if (text === undefined) return;
    try {
      const identity = archive.metadataEntries.get(path)!;
      budget.inspect(identity, text);
      parts.set(path, text);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "docx_xml_invalid") throw error;
      // Optional malformed metadata remains unavailable; safety failures do not.
    }
  }
  await read("/_rels/.rels");
  await read("/[Content_Types].xml");
  const paths = resolveDocxMetadataPartPaths(parts);
  if (paths.corePropertiesPath) await read(paths.corePropertiesPath);
  if (paths.appPropertiesPath) await read(paths.appPropertiesPath);
  return readDocxCoreMetadataFromParts(parts);
}
