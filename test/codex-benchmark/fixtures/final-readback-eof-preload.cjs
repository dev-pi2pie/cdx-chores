const childProcess = require("node:child_process");
const files = require("node:fs/promises");
const { syncBuiltinESMExports } = require("node:module");
const { join } = require("node:path");

let stdoutEnded;
const spawn = childProcess.spawn;
childProcess.spawn = (executable, args, options) => {
  const child = spawn(executable, args, options);
  if (args?.[0] === "app-server") {
    stdoutEnded = new Promise((resolve) => child.stdout.once("end", resolve));
  }
  return child;
};

const home = process.env.CODEX_HOME;
const finalRollout = join(home, `thread-${process.env.FIXTURE_TURN_THREAD ?? 2}.jsonl`);
const readFile = files.readFile;
files.readFile = async (path, options) => {
  // Resume only after the parent has dispatched EOF and its transport handler has run.
  if (path === finalRollout && stdoutEnded) {
    await stdoutEnded;
    await files.writeFile(join(home, "final-readback-after-eof"), "");
  }
  return readFile(path, options);
};
syncBuiltinESMExports();
