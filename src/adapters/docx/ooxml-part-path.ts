import { posix as pathPosix } from "node:path";

function decodePackagePartSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function normalizePackagePartPath(value: string): string {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  const decodedSegments = withLeadingSlash
    .split("/")
    .map((segment) => decodePackagePartSegment(segment))
    .join("/");
  const normalized = pathPosix.normalize(decodedSegments);
  return normalized === "." ? "/" : normalized;
}
