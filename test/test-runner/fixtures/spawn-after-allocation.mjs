import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { constants } from "node:os";

import {
  isLiveProcess,
  observeProcessGroup,
} from "../../../scripts/testing/execution/process-table.ts";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process.ts";

const childProcess = createRequire(import.meta.url)("node:child_process");
const spawn = childProcess.spawn;
const code = process.argv[2];
assert(["ENOTDIR", "ELOOP", "ENAMETOOLONG"].includes(code));
const failure = Object.assign(new Error(`spawn ${code}`), {
  code,
  errno: -constants.errno[code],
  syscall: "spawn",
});
let child;
let closed;
childProcess.spawn = (...args) => {
  child = spawn(...args);
  closed = once(child, "close");
  throw failure;
};
syncBuiltinESMExports();
try {
  assert.throws(
    () =>
      startFixtureProcess({
        executable: process.execPath,
        args: ["-e", "setTimeout(() => {}, 5000)"],
        cwd: process.cwd(),
        env: {},
        timeoutMs: 2_000,
        graceMs: 250,
        cleanupMs: 1_500,
      }),
    (error) => error === failure,
  );
  assert(child?.pid);
  assert(
    (await observeProcessGroup(child.pid, 500)).some(
      (member) => member.pid === child.pid && isLiveProcess(member),
    ),
  );
} finally {
  childProcess.spawn = spawn;
  syncBuiltinESMExports();
  if (child?.pid) {
    child.kill("SIGKILL");
    await closed;
    assert(!(await observeProcessGroup(child.pid, 500)).some(isLiveProcess));
  }
}
console.log("Observed and stopped the child from the throwing spawn.");
