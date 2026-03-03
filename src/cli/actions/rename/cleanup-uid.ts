import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";

const CROCKFORD_BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

function encodeLowerCrockfordBase32(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += CROCKFORD_BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += CROCKFORD_BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

async function buildCleanupUidDigestText(sourcePath: string): Promise<string> {
  const normalizedRealPath = (await realpath(sourcePath)).replace(/\\/g, "/");
  const payload = `rename-cleanup-uid-v1\0${normalizedRealPath}`;
  const digest = createHash("sha256").update(payload, "utf8").digest();
  return encodeLowerCrockfordBase32(digest);
}

export async function buildCleanupUidBasenames(sourcePath: string): Promise<string[]> {
  const digestText = await buildCleanupUidDigestText(sourcePath);
  return [10, 13, 16].map((length) => `uid-${digestText.slice(0, length)}`);
}
