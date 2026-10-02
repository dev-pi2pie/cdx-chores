import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { sourceRgbProfile, type ImageTransfer } from "../../../src/cli/video-frames/color-profile";

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
  expect(curve.readUInt16BE(8)).toBe(3);
  const [g, a, b, c, d] = Array.from(
    { length: 5 },
    (_, i) => curve.readInt32BE(12 + i * 4) / 65536,
  );
  return value >= d! ? (a! * value + b!) ** g! : c! * value;
}
for (const transfer of ["bt709", "iec61966-2-1"] as const) {
  test(`${transfer} profile has bounded, deterministic RGB/XYZ metadata and a standard ICC ID`, () => {
    const profile = sourceRgbProfile(transfer);
    expect(profile).toEqual(sourceRgbProfile(transfer));
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
  test(`${transfer} profile describes shadows and midtones using inverse source transfer`, () => {
    const described = tags(sourceRgbProfile(transfer));
    for (const input of [0, 1 / 255, 19 / 255, 0.08125, 0.25, 0.5, 1]) {
      const expected =
        transfer === "bt709"
          ? input < 0.0812428582986315
            ? input / 4.5
            : ((input + 0.099296826809442) / 1.099296826809442) ** (1 / 0.45)
          : input <= 0.04045
            ? input / 12.92
            : ((input + 0.055) / 1.055) ** 2.4;
      for (const name of ["rTRC", "gTRC", "bTRC"])
        expect(Math.abs(decode(described.get(name)!, input) - expected)).toBeLessThan(0.00003);
    }
    if (transfer === "bt709")
      expect(Math.abs(decode(described.get("rTRC")!, 0.5) - 0.5 ** 2.4)).toBeGreaterThan(0.05);
  });
}
test("unverified transfers never receive a substitute profile", () => {
  expect(() => sourceRgbProfile("smpte2084" as ImageTransfer)).toThrow(
    "Unsupported source transfer",
  );
});
