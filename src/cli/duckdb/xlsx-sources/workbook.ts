import { readFile } from "node:fs/promises";
import { posix as pathPosix } from "node:path";

import { CliError } from "../../errors";
import { toErrorMessage } from "./errors";
import type { XlsxWorkbookPackage, XlsxWorkbookSheetEntry } from "./types";
import { decodeXmlEntities, extractXmlAttribute } from "./xml";
import { extractRequiredZipEntryText, extractZipEntry, readCentralDirectoryEntries } from "./zip";

export async function readXlsxWorkbookPackage(inputPath: string): Promise<XlsxWorkbookPackage> {
  let buffer: Buffer;
  try {
    buffer = await readFile(inputPath);
  } catch (error) {
    throw new CliError(`Failed to read .xlsx workbook: ${inputPath} (${toErrorMessage(error)})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  return {
    buffer,
    entries: readCentralDirectoryEntries(buffer),
  };
}

function normalizeZipTargetPath(baseFileName: string, target: string): string {
  if (target.startsWith("/")) {
    return target.replace(/^\/+/, "");
  }
  return pathPosix.normalize(pathPosix.join(pathPosix.dirname(baseFileName), target));
}

export function listWorkbookSheetEntries(pkg: XlsxWorkbookPackage): XlsxWorkbookSheetEntry[] {
  const workbookXml = extractRequiredZipEntryText(pkg.buffer, pkg.entries, "xl/workbook.xml");
  const workbookRelsXml = extractRequiredZipEntryText(
    pkg.buffer,
    pkg.entries,
    "xl/_rels/workbook.xml.rels",
  );

  const targetByRelationshipId = new Map(
    [...workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)]
      .map((match) => {
        const attributes = match[1] ?? "";
        const relationshipId = extractXmlAttribute(attributes, "Id")?.trim() ?? "";
        const target = extractXmlAttribute(attributes, "Target")?.trim() ?? "";
        return relationshipId && target
          ? ([relationshipId, normalizeZipTargetPath("xl/workbook.xml", target)] as const)
          : undefined;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );

  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)]
    .map((match) => {
      const attributes = match[1] ?? "";
      const name = extractXmlAttribute(attributes, "name")?.trim() ?? "";
      const relationshipId = extractXmlAttribute(attributes, "r:id")?.trim() ?? "";
      return name && relationshipId
        ? {
            name,
            relationshipId,
          }
        : undefined;
    })
    .filter(
      (
        entry,
      ): entry is {
        name: string;
        relationshipId: string;
      } => Boolean(entry),
    );

  const resolvedSheets = sheets.map((sheet) => ({
    name: sheet.name,
    targetPath: targetByRelationshipId.get(sheet.relationshipId) ?? "",
  }));

  if (
    resolvedSheets.length === 0 ||
    resolvedSheets.some((sheet) => sheet.targetPath.length === 0)
  ) {
    throw new CliError("Invalid .xlsx file: failed to resolve worksheet metadata.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return resolvedSheets;
}

export function parseSharedStrings(pkg: XlsxWorkbookPackage): string[] {
  const sharedStringsEntry = pkg.entries.find((entry) => entry.fileName === "xl/sharedStrings.xml");
  if (!sharedStringsEntry) {
    return [];
  }

  const xml = extractZipEntry(pkg.buffer, sharedStringsEntry).toString("utf8");
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const body = match[1] ?? "";
    return [...body.matchAll(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXmlEntities(textMatch[1] ?? ""))
      .join("");
  });
}

export async function listXlsxSheetNames(inputPath: string): Promise<string[]> {
  try {
    const pkg = await readXlsxWorkbookPackage(inputPath);
    const sheets = listWorkbookSheetEntries(pkg).map((sheet) => sheet.name);
    if (sheets.length === 0) {
      throw new CliError("No worksheet sources found in the .xlsx workbook.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return sheets;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(
      `Invalid .xlsx file: failed to read workbook metadata (${toErrorMessage(error)}).`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}
