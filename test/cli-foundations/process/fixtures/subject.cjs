const { once } = require("node:events");
const { writeSync } = require("node:fs");
const mode = process.argv[2];
async function main() {
  if (mode === "records" || mode === "prefix") {
    for (let i = 0; i < 20000; i++)
      if (!process.stdout.write(`${i}:` + "x".repeat(96) + "\n"))
        await once(process.stdout, "drain");
  } else if (mode === "metadata") process.stdout.write("x".repeat(1048577));
  else if (mode === "stderr") {
    process.stderr.write("e".repeat(70000) + "TAIL!");
    process.stdout.write("ok");
  } else if (mode === "progress") {
    writeSync(3, "frame=1\nout_time_us=40000\nprogress=end\n");
    process.stdout.write("ok");
  } else if (mode === "args") process.stdout.write(JSON.stringify(process.argv.slice(3)));
  else if (mode === "cooperative" || mode === "resistant") {
    process.on("SIGTERM", () => {
      if (mode === "cooperative") process.exit(0);
    });
    process.stdout.write("ready\n");
    setInterval(() => {}, 1000);
  } else {
    process.stderr.write("decoder failure\n");
    process.exitCode = 4;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
