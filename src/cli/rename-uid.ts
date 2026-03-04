import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { basename, extname } from "node:path";

const CROCKFORD_BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const CANONICAL_RENAME_UID_BASENAME_PATTERN = /^uid-([0-9a-hjkmnpqrstvwxyz]{10,16})$/i;

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

async function buildRenameUidDigestText(sourcePath: string): Promise<string> {
  const normalizedRealPath = (await realpath(sourcePath)).replace(/\\/g, "/");
  const payload = `rename-cleanup-uid-v1\0${normalizedRealPath}`;
  const digest = createHash("sha256").update(payload, "utf8").digest();
  return encodeLowerCrockfordBase32(digest);
}

export async function buildRenameUidBasenames(sourcePath: string): Promise<string[]> {
  const sourceName = basename(sourcePath);
  const sourceStem = basename(sourceName, extname(sourceName));
  const canonicalMatch = CANONICAL_RENAME_UID_BASENAME_PATTERN.exec(sourceStem);
  if (canonicalMatch?.[1]) {
    return [`uid-${canonicalMatch[1].toLowerCase()}`];
  }

  const digestText = await buildRenameUidDigestText(sourcePath);
  return [10, 13, 16].map((length) => `uid-${digestText.slice(0, length)}`);
}

export async function buildRenameUidBasename(sourcePath: string): Promise<string> {
  const [first] = await buildRenameUidBasenames(sourcePath);
  return first ?? "uid-0000000000";
}
