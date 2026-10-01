#!/usr/bin/env node
const fs = require("node:fs");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const args = process.argv.slice(2),
  source = args.at(-1),
  config = JSON.parse(fs.readFileSync(source, "utf8"));
if (args[args.indexOf("-max_pixels") + 1] !== "16777216") throw new Error("Missing decoder guard");
async function main() {
  if (!args.includes("-show_frames")) {
    process.stdout.write(
      JSON.stringify({
        streams: config.streams,
        ...(config.hugeMetadata ? { extra: "x".repeat(1048576) } : {}),
      }),
    );
    return;
  }
  const selected = args[args.indexOf("-select_streams") + 1];
  if (selected !== "2") throw new Error("Wrong selected stream");
  if (config.oversizedRecord) {
    process.stdout.write("x".repeat(65537) + "\n");
    return;
  }
  for (let i = 0; i < config.count; i++) {
    const start = config.starts ? config.starts[i] : i * 40;
    const duration = config.durations ? config.durations[i] : 40;
    if (config.delay) await delay(config.delay);
    const line = `frame|stream_index=2|best_effort_timestamp=${start ?? "N/A"}|pts=${start ?? "N/A"}|duration=${duration ?? "N/A"}|pict_type=P|\n`;
    if (!process.stdout.write(line)) await once(process.stdout, "drain");
    if (config.decodeError && i === 1) {
      process.stderr.write("controlled decode error\n");
      return;
    }
  }
  if (config.partial) process.stdout.write("frame|stream_index=2|pts=");
  if (config.mutate) fs.appendFileSync(source, " ");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
