import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  imageRgbProfile,
  type RgbImageInterpretation,
} from "../../../src/cli/video-frames/color-profile";

function tags(profile: Buffer) {
  const result = new Map<string, Buffer>();
  for (let index = 0; index < profile.readUInt32BE(128); index++) {
    const entry = 132 + index * 12;
    const start = profile.readUInt32BE(entry + 4);
    const length = profile.readUInt32BE(entry + 8);
    expect(start % 4).toBe(0);
    expect(start + length).toBeLessThanOrEqual(profile.length);
    result.set(
      profile.toString("ascii", entry, entry + 4),
      profile.subarray(start, start + length),
    );
  }
  return result;
}
function decode(curve: Buffer, value: number) {
  expect(curve.toString("ascii", 0, 4)).toBe("para");
  if (curve.readUInt16BE(8) === 0) return value ** (curve.readInt32BE(12) / 65536);
  expect(curve.readUInt16BE(8)).toBe(3);
  const [g, a, b, c, d] = Array.from(
    { length: 5 },
    (_, i) => curve.readInt32BE(12 + i * 4) / 65536,
  );
  return value >= d! ? (a! * value + b!) ** g! : c! * value;
}
for (const interpretation of ["coremedia709", "srgb"] as const) {
  test(`${interpretation} profile has bounded, deterministic RGB/XYZ metadata and a standard ICC ID`, () => {
    const profile = imageRgbProfile(interpretation);
    expect(profile).toEqual(imageRgbProfile(interpretation));
    expect(profile.length).toBeLessThan(4096);
    expect(profile.readUInt32BE(0)).toBe(profile.length);
    expect(profile.toString("ascii", 16, 24)).toBe("RGB XYZ ");
    expect(profile.toString("ascii", 36, 40)).toBe("acsp");
    const described = tags(profile);
    for (const name of ["wtpt", "chad", "rXYZ", "gXYZ", "bXYZ", "rTRC", "gTRC", "bTRC"])
      expect(described.has(name)).toBe(true);
    const canonical = Buffer.from(profile);
    canonical.fill(0, 44, 48);
    canonical.fill(0, 64, 68);
    canonical.fill(0, 84, 100);
    expect(profile.subarray(84, 100)).toEqual(createHash("md5").update(canonical).digest());
  });
  test(`${interpretation} profile describes the selected image interpretation through shadows and midtones`, () => {
    const described = tags(imageRgbProfile(interpretation));
    for (const input of [0, 1 / 255, 19 / 255, 0.08125, 0.25, 0.5, 1]) {
      const expected =
        interpretation === "coremedia709"
          ? input ** (502 / 256)
          : input <= 0.04045
            ? input / 12.92
            : ((input + 0.055) / 1.055) ** 2.4;
      for (const name of ["rTRC", "gTRC", "bTRC"])
        expect(Math.abs(decode(described.get(name)!, input) - expected)).toBeLessThan(0.00003);
    }
    if (interpretation === "coremedia709") {
      const dark = decode(described.get("rTRC")!, 19 / 255);
      expect(Math.abs(dark - 19 / 255 / 4.5)).toBeGreaterThan(0.009);
      expect(Math.abs(dark - (19 / 255) ** 2.4)).toBeGreaterThan(0.003);
    }
  });
}
test("signal labels and unverified interpretations never receive a substitute profile", () => {
  for (const value of ["bt709", "smpte2084"])
    expect(() => imageRgbProfile(value as RgbImageInterpretation)).toThrow(
      "Unsupported RGB image interpretation",
    );
});
