import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = (name: string) => fileURLToPath(new URL(name, import.meta.url));
writeFileSync(root("./child-pid"), String(process.pid));
const mode = basename(fileURLToPath(import.meta.url))
  .replace("protocol-", "")
  .replace("-child.mjs", "");
const valid = {
  ok: true,
  facts: {
    rawText: "Independent fixture report\n\n",
    headings: [],
    hasContent: true,
    metadataResult: { warnings: [] },
    diagnostics: [],
  },
};
const frame = (body: Buffer, declared = body.length) => {
  const header = Buffer.alloc(12);
  header.write("CDXDRS01");
  header.writeUInt32BE(declared, 8);
  return Buffer.concat([header, body]);
};

process.stdin.resume();
process.stdin.on("error", () => process.exit(1));
process.stdin.on("end", () => {
  if (mode !== "stubborn") process.exit(0);
});
if (mode === "stubborn") {
  process.on("SIGTERM", () => {});
  let tick = 0;
  setInterval(() => writeFileSync(root("./child-heartbeat"), String(++tick)), 10);
} else {
  const body = Buffer.from(JSON.stringify(valid));
  const ordinary = frame(body);
  const bytes: Record<string, Buffer> = {
    valid: ordinary,
    "success-crash": ordinary,
    malformed: Buffer.from("not a protocol frame"),
    oversized: frame(Buffer.alloc(0), 0xffff_ffff),
    truncated: frame(body, body.length + 1),
    trailing: Buffer.concat([ordinary, Buffer.from([0])]),
    second: Buffer.concat([ordinary, ordinary]),
    utf8: frame(Buffer.from([0xc3, 0x28])),
    schema: frame(
      Buffer.from(JSON.stringify({ ...valid, facts: { ...valid.facts, rawText: 42 } })),
    ),
  };
  setTimeout(() => {
    if (mode === "early-exit") process.exit(0);
    if (mode === "crash") process.exit(23);
    const selected = bytes[mode];
    if (!selected) throw new Error("Unknown synthetic protocol mode");
    process.stdout.write(selected, () => process.exit(mode === "success-crash" ? 23 : 0));
  }, 20);
}
