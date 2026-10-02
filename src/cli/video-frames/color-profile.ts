import { createHash } from "node:crypto";
import { CliError } from "../errors";

export type ImageTransfer = "bt709" | "iec61966-2-1";

/** ICC v4 matrix/shaper description of full-range source-coded BT.709 RGB.
 * The BT.709 curve is the inverse signal transfer, not a BT.1886 display gamma.
 */
export function sourceRgbProfile(transfer: ImageTransfer): Buffer {
  if (transfer !== "bt709" && transfer !== "iec61966-2-1")
    throw new CliError("Unsupported source transfer for the RGB color profile.", {
      code: "FRAME_COLOR_UNSUPPORTED",
    });
  const coefficients =
    transfer === "bt709"
      ? [1 / 0.45, 1 / 1.099296826809442, 1 - 1 / 1.099296826809442, 1 / 4.5, 0.0812428582986315]
      : [2.4, 1 / 1.055, 0.055 / 1.055, 1 / 12.92, 0.04045];
  const curve = Buffer.alloc(32);
  curve.write("para");
  curve.writeUInt16BE(3, 8);
  coefficients.forEach((value, index) => fixed(curve, 12 + index * 4, value));
  const tags: [string, Buffer][] = [
    ["desc", text(`BT.709 RGB with inverse ${transfer} signal transfer`)],
    ["cprt", text("cdx-chores color profile")],
    ["wtpt", numbers("XYZ ", [0.9642, 1, 0.8249])],
    [
      "chad",
      numbers(
        "sf32",
        [
          1.0479298, 0.0229468, -0.0501922, 0.0296278, 0.9904345, -0.0170738, -0.009243, 0.0150552,
          0.7518743,
        ],
      ),
    ],
    ["rXYZ", numbers("XYZ ", [0.4360747, 0.2225045, 0.0139322])],
    ["gXYZ", numbers("XYZ ", [0.3850649, 0.7168786, 0.0971045])],
    ["bXYZ", numbers("XYZ ", [0.1430804, 0.0606169, 0.7141733])],
    ["rTRC", curve],
    ["gTRC", curve],
    ["bTRC", curve],
  ];
  let offset = 132 + tags.length * 12;
  const header = Buffer.alloc(offset);
  header.writeUInt32BE(0x04300000, 8);
  header.write("mntr", 12);
  header.write("RGB ", 16);
  header.write("XYZ ", 20);
  [2026, 10, 2, 0, 0, 0].forEach((value, index) => header.writeUInt16BE(value, 24 + index * 2));
  header.write("acsp", 36);
  [0.9642, 1, 0.8249].forEach((value, index) => fixed(header, 68 + index * 4, value));
  header.write("cdxc", 80);
  header.writeUInt32BE(tags.length, 128);
  const bodies: Buffer[] = [];
  tags.forEach(([name, body], index) => {
    const entry = 132 + index * 12;
    header.write(name, entry);
    header.writeUInt32BE(offset, entry + 4);
    header.writeUInt32BE(body.length, entry + 8);
    const padding = Buffer.alloc((4 - (body.length % 4)) % 4);
    bodies.push(body, padding);
    offset += body.length + padding.length;
  });
  header.writeUInt32BE(offset);
  const profile = Buffer.concat([header, ...bodies]);
  // ICC profile ID excludes flags, rendering intent and the ID itself.
  createHash("md5").update(profile).digest().copy(profile, 84);
  profile.writeUInt32BE(1, 64); // Relative colorimetric intent.
  return profile;
}

function fixed(bytes: Buffer, offset: number, value: number) {
  bytes.writeInt32BE(Math.round(value * 65536), offset);
}
function numbers(type: string, values: number[]) {
  const bytes = Buffer.alloc(8 + values.length * 4);
  bytes.write(type);
  values.forEach((value, index) => fixed(bytes, 8 + index * 4, value));
  return bytes;
}
function text(value: string) {
  const characters = Buffer.from(value, "utf16le").swap16();
  const bytes = Buffer.alloc(28 + characters.length);
  bytes.write("mluc");
  bytes.writeUInt32BE(1, 8);
  bytes.writeUInt32BE(12, 12);
  bytes.write("enUS", 16);
  bytes.writeUInt32BE(characters.length, 20);
  bytes.writeUInt32BE(28, 24);
  characters.copy(bytes, 28);
  return bytes;
}
