import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Manual package checks cover ownership without expanding regular app-test work. */
export async function verifyPackageProcessOwnership(workspace, env, runCommand) {
  assert.equal(typeof runCommand, "function");
  let index = 0;
  const run = (path, args, timeout) =>
    runCommand(path, args, {
      cwd: workspace,
      env,
      timeout,
      log: join(workspace, `ownership-${index++}.log`),
    });
  assert.equal(
    await run(process.execPath, ["-e", 'process.stdout.write("ready")'], 5_000),
    "ready",
  );
  await assert.rejects(() => run(join(workspace, "missing-executable"), [], 5_000), {
    message: "package command failed",
  });
  const timedPid = join(workspace, "timed.pid");
  await assert.rejects(
    () =>
      run(
        process.execPath,
        [
          "-e",
          `
    process.on("SIGTERM", () => {});
    require("node:fs").writeFileSync(${JSON.stringify(timedPid)}, String(process.pid));
    setInterval(() => {}, 1000);
  `,
        ],
        500,
      ),
    { message: "package command failed" },
  );
  const timed = Number(await readFile(timedPid, "utf8"));
  assert.throws(() => process.kill(timed, 0), { code: "ESRCH" });

  const descendantPid = join(workspace, "descendant.pid");
  await run(
    process.execPath,
    [
      "-e",
      `
    const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    require("node:fs").writeFileSync(${JSON.stringify(descendantPid)}, String(child.pid));
    child.unref();
  `,
    ],
    5_000,
  );
  const descendant = Number(await readFile(descendantPid, "utf8"));
  assert.throws(() => process.kill(descendant, 0), { code: "ESRCH" });
}
