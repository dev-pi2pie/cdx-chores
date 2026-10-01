// Independent raw-pixel reference: labels and identities are set before any tool runs.
const DIGITS = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001001001001",
  "111101111101111",
  "111101111001111",
];

export function referenceFrame(
  ordinal: number,
  count: number,
  width = 96,
  height = 64,
  alpha = false,
  stream = 0,
): Buffer {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 40 + Math.floor((x * 120) / width);
      pixels[offset + 1] = 50 + Math.floor((y * 120) / height);
      pixels[offset + 2] = 60 + stream * 50;
      pixels[offset + 3] = alpha && x < width / 2 ? 128 : 255;
    }
  const rect = (x: number, y: number, w: number, h: number, color: readonly number[]) => {
    for (let row = y; row < Math.min(height, y + h); row++)
      for (let col = x; col < Math.min(width, x + w); col++) {
        const offset = (row * width + col) * 4;
        for (let channel = 0; channel < 4; channel++) pixels[offset + channel] = color[channel]!;
      }
  };
  const digits = String(ordinal);
  for (let d = 0; d < digits.length; d++) {
    const shape = DIGITS[Number(digits[d])]!;
    for (let p = 0; p < 15; p++)
      if (shape[p] === "1")
        rect(8 + d * 8 + (p % 3) * 2, 18 + Math.floor(p / 3) * 2, 2, 2, [255, 255, 255, 255]);
  }
  // Thirteen binary cells make the continuous frame identity machine-readable.
  for (let bit = 0; bit < 13; bit++) {
    const v = (ordinal >> bit) & 1 ? 255 : 0;
    rect(bit * 6, 0, 6, 8, [v, v, v, 255]);
  }
  if (ordinal === 1) rect(0, height - 8, 20, 8, [0, 255, 0, 255]);
  if (ordinal === count) rect(width - 20, height - 8, 20, 8, [255, 0, 0, 255]);
  return pixels;
}

export async function* referenceFrames(
  count: number,
  width = 96,
  height = 64,
  alpha = false,
  stream = 0,
): AsyncGenerator<Buffer> {
  for (let n = 1; n <= count; n++) yield referenceFrame(n, count, width, height, alpha, stream);
}

export function readIdentity(pixels: Buffer, width: number): number {
  let ordinal = 0;
  for (let bit = 0; bit < 13; bit++) {
    const value = pixels[(3 * width + bit * 6 + 3) * 4]!;
    if (value > 200) ordinal |= 1 << bit;
    else if (value >= 50) throw new Error("Ambiguous synthetic identity cell.");
  }
  return ordinal;
}
