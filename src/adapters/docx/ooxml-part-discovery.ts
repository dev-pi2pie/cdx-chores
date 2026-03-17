import { XMLParser, XMLValidator } from "fast-xml-parser";
import { normalizePackagePartPath } from "./ooxml-part-path";

const DOCX_PACKAGE_RELS_PATH = "/_rels/.rels";
const DOCX_CONTENT_TYPES_PATH = "/[Content_Types].xml";
const DOCX_DEFAULT_CORE_PROPERTIES_PATH = "/docProps/core.xml";
const DOCX_DEFAULT_APP_PROPERTIES_PATH = "/docProps/app.xml";
const DOCX_CORE_PROPERTIES_CONTENT_TYPE = "application/vnd.openxmlformats-package.core-properties+xml";
const DOCX_EXTENDED_PROPERTIES_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.extended-properties+xml";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

type RelationshipTargets = {
  targets: Set<string>;
};

type ContentTypeTargetPaths = {
  appPropertiesPaths: string[];
  corePropertiesPaths: string[];
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function parseRelationshipTargets(xml: string): RelationshipTargets | undefined {
  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as {
      Relationships?: { Relationship?: Record<string, unknown> | Record<string, unknown>[] };
    };
    const relationships = asArray(parsed.Relationships?.Relationship);
    const targets = new Set<string>();

    for (const relationship of relationships) {
      const target = relationship["@_Target"];
      const targetMode = relationship["@_TargetMode"];
      if (typeof targetMode === "string" && targetMode.toLowerCase() === "external") {
        continue;
      }
      if (typeof target !== "string") {
        continue;
      }
      targets.add(normalizePackagePartPath(target));
    }

    return { targets };
  } catch {
    return undefined;
  }
}

function parseContentTypeTargetPaths(xml: string): ContentTypeTargetPaths | undefined {
  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as {
      Types?: { Override?: Record<string, unknown> | Record<string, unknown>[] };
    };
    const overrides = asArray(parsed.Types?.Override);
    const targets: ContentTypeTargetPaths = {
      appPropertiesPaths: [],
      corePropertiesPaths: [],
    };

    for (const override of overrides) {
      const partName = override["@_PartName"];
      const contentType = override["@_ContentType"];
      if (typeof partName !== "string" || typeof contentType !== "string") {
        continue;
      }
      const normalizedPartName = normalizePackagePartPath(partName);
      if (contentType === DOCX_CORE_PROPERTIES_CONTENT_TYPE) {
        targets.corePropertiesPaths.push(normalizedPartName);
      } else if (contentType === DOCX_EXTENDED_PROPERTIES_CONTENT_TYPE) {
        targets.appPropertiesPaths.push(normalizedPartName);
      }
    }

    return targets;
  } catch {
    return undefined;
  }
}

function resolveMetadataPartPath(options: {
  defaultPath: string;
  fallbackSuffix: string;
  parts: Map<string, string>;
  relationshipTargets?: Set<string>;
  typedPaths: string[];
}): string | undefined {
  for (const typedPath of options.typedPaths) {
    if (options.relationshipTargets?.has(typedPath) && options.parts.has(typedPath)) {
      return typedPath;
    }
  }

  for (const typedPath of options.typedPaths) {
    if (options.parts.has(typedPath)) {
      return typedPath;
    }
  }

  if (options.relationshipTargets) {
    for (const relationshipTarget of options.relationshipTargets) {
      if (relationshipTarget.endsWith(options.fallbackSuffix) && options.parts.has(relationshipTarget)) {
        return relationshipTarget;
      }
    }
  }

  return options.parts.has(options.defaultPath) ? options.defaultPath : undefined;
}

export function resolveDocxMetadataPartPaths(parts: Map<string, string>): {
  appPropertiesPath?: string;
  corePropertiesPath?: string;
} {
  const relationshipTargets = parseRelationshipTargets(parts.get(DOCX_PACKAGE_RELS_PATH) ?? "");
  const contentTypeTargets = parseContentTypeTargetPaths(parts.get(DOCX_CONTENT_TYPES_PATH) ?? "");

  return {
    corePropertiesPath: resolveMetadataPartPath({
      defaultPath: DOCX_DEFAULT_CORE_PROPERTIES_PATH,
      fallbackSuffix: "/core.xml",
      parts,
      relationshipTargets: relationshipTargets?.targets,
      typedPaths: contentTypeTargets?.corePropertiesPaths ?? [],
    }),
    appPropertiesPath: resolveMetadataPartPath({
      defaultPath: DOCX_DEFAULT_APP_PROPERTIES_PATH,
      fallbackSuffix: "/app.xml",
      parts,
      relationshipTargets: relationshipTargets?.targets,
      typedPaths: contentTypeTargets?.appPropertiesPaths ?? [],
    }),
  };
}
