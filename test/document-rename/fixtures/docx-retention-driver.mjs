import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { runCandidateDriver } from "../../../scripts/docx-candidate/driver.mjs";
import { prepareSmokeRetention } from "../../../scripts/docx-candidate/retention.mjs";

const [mode, root] = process.argv.slice(2);
const repo = join(root, "repo");
await mkdir(repo);
const retention =
  mode === "default"
    ? undefined
    : await prepareSmokeRetention(repo, { expectedCaseIds: ["case-one"] });
const subject = fileURLToPath(new URL("./docx-harness-subject.cjs", import.meta.url));
let workspace;
let timer;
try {
  await runCandidateDriver(
    {
      title: "Synthetic retained validation",
      scope: mode,
      prefix: "cdx-docx-candidate-",
      failure: () => "guarded reader: passed no\n",
      retain:
        mode === "default"
          ? undefined
          : async (path, outcome) => {
              await writeFile(join(root, "publication-attempted"), "yes");
              if (mode === "export-failure") throw new Error("private export details");
              return retention.publish(path, outcome);
            },
    },
    async (harness, path) => {
      workspace = path;
      const staged = join(path, "smoke-artifacts", "esm", "case-one");
      await mkdir(staged, { recursive: true });
      await writeFile(join(staged, "input.docx"), "synthetic input");
      await writeFile(
        join(staged, "result.json"),
        JSON.stringify({ id: "case-one", format: "esm", outcome: "pending" }),
      );
      const pidFile = join(path, "subject.pid");
      const cancellation = mode === "cancel" || mode === "cancel-term";
      if (cancellation)
        timer = setInterval(() => {
          if (existsSync(pidFile)) {
            clearInterval(timer);
            process.kill(process.pid, mode === "cancel" ? "SIGINT" : "SIGTERM");
          }
        }, 10);
      await harness.command(
        process.execPath,
        [
          subject,
          mode === "default" ? "progress" : mode === "export-failure" ? "failure" : mode,
          pidFile,
        ],
        {
          label: "Synthetic comparison",
          stage: "comparison",
          cwd: path,
          env: {},
          timeout: 1_000,
          cleanupMs: mode === "unconfirmed" ? 1 : 1_500,
          progress: true,
        },
      );
      return "guarded reader: passed yes\n";
    },
  );
  if (mode === "unconfirmed") {
    assert(!existsSync(join(root, "publication-attempted")));
    assert.deepEqual(await readdir(join(repo, "examples/playground/docx-candidate/smoke")), []);
    await delay(400);
    const pid = Number(await readFile(join(workspace, "subject.pid"), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  }
} finally {
  clearInterval(timer);
}
