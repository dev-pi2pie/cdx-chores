import assert from "node:assert/strict";

/** Check the generated constant without rewriting the checkout. */
export function assertEmbeddedVersion(source, expectedVersion) {
  const literal =
    typeof source === "string"
      ? source.match(
          /^export const EMBEDDED_PACKAGE_VERSION\s*=\s*("(?:[^"\\\r\n]|\\.)*");\s*$/m,
        )?.[1]
      : undefined;
  let embeddedVersion;
  try {
    embeddedVersion = literal === undefined ? undefined : JSON.parse(literal);
  } catch {
    // A malformed generated literal is reported by the consistency check below.
  }
  assert.equal(
    embeddedVersion,
    expectedVersion,
    "Embedded package version is missing, malformed, or stale; run node scripts/generate-embedded-version.mjs before package verification",
  );
}
