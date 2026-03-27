import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface DocxCoreMetadata {
  title?: string;
  creator?: string;
  subject?: string;
  description?: string;
  lastModifiedBy?: string;
  created?: string;
  modified?: string;
  application?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getElementText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized || undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const textValue = (value as Record<string, unknown>)["#text"];
  if (typeof textValue !== "string") {
    return undefined;
  }

  const normalized = normalizeWhitespace(textValue);
  return normalized || undefined;
}

export function parseDocxCoreProperties(xml: string): DocxCoreMetadata | undefined {
  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as { coreProperties?: Record<string, unknown> };
    const root = parsed.coreProperties;
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return undefined;
    }

    const metadata: DocxCoreMetadata = {
      title: getElementText(root.title),
      creator: getElementText(root.creator),
      subject: getElementText(root.subject),
      description: getElementText(root.description),
      lastModifiedBy: getElementText(root.lastModifiedBy),
      created: getElementText(root.created),
      modified: getElementText(root.modified),
    };

    return Object.values(metadata).some((value) => Boolean(value)) ? metadata : {};
  } catch {
    return undefined;
  }
}

export function parseDocxExtendedPropertiesApplication(
  xml: string | undefined,
): string | undefined {
  if (!xml) {
    return undefined;
  }

  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as { Properties?: Record<string, unknown> };
    return getElementText(parsed.Properties?.Application);
  } catch {
    return undefined;
  }
}
