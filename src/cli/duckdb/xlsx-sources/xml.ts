export function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function extractXmlAttribute(attributes: string, attributeName: string): string | undefined {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(['"])([\\s\\S]*?)\\1`).exec(
    attributes,
  );
  return typeof match?.[2] === "string" ? decodeXmlEntities(match[2]) : undefined;
}
