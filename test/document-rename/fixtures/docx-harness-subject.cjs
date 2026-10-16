const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");

const [mode, pidFile] = process.argv.slice(2);
if (mode === "progress") {
  process.stderr.write('DOCX_PROGRESS {"event":"scope","total":1}\nDOCX_PRO');
  setTimeout(() => {
    process.stderr.write('GRESS {"event":"start","id":"synthetic-case"}\n');
    setTimeout(() => {
      process.stderr.write(
        'DOCX_PROGRESS {"event":"complete","id":"synthetic-case","completed":1}\n',
      );
      process.stdout.write("stable result\n");
    }, 50);
  }, 50);
} else if (["timeout", "cancel", "cancel-term", "unconfirmed"].includes(mode)) {
  process.on("SIGTERM", () => {});
  process.stderr.write(
    'DOCX_PROGRESS {"event":"scope","total":1}\nDOCX_PROGRESS {"event":"start","id":"resource-maxPartDecompressedBytes-at"}\n',
    () => writeFileSync(pidFile, String(process.pid)),
  );
  setInterval(() => {}, 1000);
} else if (mode === "descendant" || mode === "descendant-pipes") {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: mode === "descendant-pipes" ? ["ignore", process.stdout, process.stderr] : "ignore",
  });
  writeFileSync(pidFile, String(child.pid));
  child.unref();
} else if (mode === "overflow") {
  process.stdout.write("x".repeat(8192));
  setInterval(() => {}, 1000);
} else if (mode === "failure") {
  process.stderr.write(
    'DOCX_PROGRESS {"event":"scope","total":1}\nDOCX_PROGRESS {"event":"start","id":"synthetic-case"}\nprivate failure contents\n',
  );
  process.exitCode = 1;
}
