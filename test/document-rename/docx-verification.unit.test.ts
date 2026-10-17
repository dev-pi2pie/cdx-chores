import { describe, expect, test } from "bun:test";

import { measurementWithinTime } from "../../scripts/docx-candidate/measurement-fit.mjs";
import { assertEmbeddedVersion } from "../../scripts/docx-candidate/verify-preflight.mjs";

describe("DOCX verification policies", () => {
  test("accepts the current generated constant and rejects absent, stale, or malformed versions", () => {
    const version = "1.2.3";
    const declaration = (value: string) =>
      `export const EMBEDDED_PACKAGE_VERSION = ${JSON.stringify(value)};`;
    expect(() => assertEmbeddedVersion(declaration(version), version)).not.toThrow();
    for (const source of [
      undefined,
      "",
      declaration("0.0.0"),
      "export const EMBEDDED_PACKAGE_VERSION = nope;",
      'export const EMBEDDED_PACKAGE_VERSION = "broken\\q";',
    ]) {
      expect(() => assertEmbeddedVersion(source, version)).toThrow(
        "run node scripts/generate-embedded-version.mjs",
      );
    }
  });

  test("processing expires at five seconds while complete API timing includes cleanup", () => {
    expect(measurementWithinTime(4_800, [5_800, 5_800, 5_800], 5_000)).toBe(true);
    expect(measurementWithinTime(5_500, [5_800, 5_800, 5_800], 5_000)).toBe(false);
    for (const processing of [4_999, 5_000, 5_001]) {
      expect(measurementWithinTime(processing, [6_000, 6_000, 6_000], 5_000)).toBe(
        processing < 5_000,
      );
    }
    for (let position = 0; position < 3; position++) {
      const api = [5_800, 5_800, 5_800];
      api[position] = 6_001;
      expect(measurementWithinTime(4_800, api, 5_000)).toBe(false);
    }
  });

  test("missing, nonfinite, and negative observations cannot pass", () => {
    for (const invalid of [undefined, null, NaN, Infinity, -1]) {
      expect(measurementWithinTime(invalid, [5_800, 5_800, 5_800], 5_000)).toBe(false);
      for (let position = 0; position < 3; position++) {
        const api: (number | null | undefined)[] = [5_800, 5_800, 5_800];
        api[position] = invalid;
        expect(measurementWithinTime(4_800, api, 5_000)).toBe(false);
      }
    }
  });
});
