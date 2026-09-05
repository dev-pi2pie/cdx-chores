const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");

const mode = process.argv[2];
const marker = process.argv[3];
const ready = () => process.stdout.write(`ready:${process.pid}\n`);
const stay = () => setInterval(() => {}, 1000);

if (mode === "exit") {
  process.stdout.write("finished\n");
} else if (mode === "fail") {
  process.stderr.write("subject failure\n");
  process.exitCode = 7;
} else if (mode === "server") {
  process.on("SIGTERM", () => setTimeout(() => process.exit(0), 80));
  ready();
  stay();
} else if (mode === "resist") {
  process.on("SIGTERM", () => {});
  ready();
  stay();
} else if (mode === "hang") {
  if (marker) writeFileSync(marker, String(process.pid));
  ready();
  stay();
} else if (mode === "native-hang") {
  writeFileSync(marker, String(process.pid));
  while (true) {} // A synchronous native-style probe must not block its owner.
} else if (mode === "mark") {
  writeFileSync(marker, String(process.pid));
} else if (mode === "flood") {
  process.stdout.write("x".repeat(8192));
  stay();
} else if (mode === "launcher" || mode === "survivor" || mode === "delayed-child") {
  const childMode = mode === "survivor" ? "resist" : "server";
  const child = spawn(process.execPath, [__filename, childMode], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  child.stdout.once("data", () => {
    process.stdout.write(`child:${child.pid}\n`);
    if (mode === "survivor") {
      child.stdout.destroy();
      child.unref();
      // Exit only after the owner has observed the descendant while we live.
      process.stdin.once("data", () => process.exit(0));
    } else if (mode === "delayed-child") {
      child.kill("SIGTERM");
      child.stdout.destroy();
      child.unref();
      process.exit(0);
    } else {
      ready();
    }
  });
  if (mode === "launcher") {
    process.on("SIGTERM", () => child.kill("SIGTERM"));
    child.once("exit", () => process.exit(0));
  }
} else {
  throw new Error("Unknown process fixture mode.");
}
