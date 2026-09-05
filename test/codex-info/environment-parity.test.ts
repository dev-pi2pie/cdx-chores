import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

test("SDK execution and discovery forward the same invocation environment", async () => {
  await withTempFixtureDir("codex-env-parity", async (directory) => {
    const executable = join(directory, "codex-fixture.cjs");
    await writeFile(
      executable,
      `#!/usr/bin/env node
const env = { home: process.env.CODEX_HOME ?? null, marker: process.env.CDX_TEST_ENV_MARKER };
if (process.argv[2] === "app-server") {
  require("node:readline").createInterface({input:process.stdin}).on("line", line => {
    const m = JSON.parse(line);
    if (m.method === "initialized") return;
    const result = m.method === "initialize"
      ? {codexHome: require("node:path").resolve(process.env.CODEX_HOME || "/fixture-default"), userAgent:"cdx_chores/0.153.4 (fixture)"}
      : {config:{captured:env}};
    console.log(JSON.stringify({id:m.id,result}));
  });
} else {
  process.stdin.resume();
  process.stdin.on("end", () => {
    console.log(JSON.stringify({type:"item.completed",item:{id:"fixture",type:"agent_message",text:JSON.stringify(env)}}));
    console.log(JSON.stringify({type:"turn.completed",usage:{input_tokens:0,cached_input_tokens:0,output_tokens:0}}));
  });
}
`,
    );
    await chmod(executable, 0o755);
    const source = `
      import { startCodexReadOnlyThread } from "./src/adapters/codex/shared.ts";
      import { discoverCodexInfo } from "./src/adapters/codex/discovery/index.ts";
      const before = {...process.env};
      const thread = await startCodexReadOnlyThread(process.cwd());
      const turn = await thread.run("synthetic environment check");
      const discovery = await discoverCodexInfo({cwd:process.cwd(),view:"providers"});
      process.stdout.write(JSON.stringify({sdk:JSON.parse(turn.finalResponse),discovery:discovery.config.captured,unchanged:JSON.stringify(before)===JSON.stringify(process.env)}));
    `;
    for (const home of [
      undefined,
      "",
      "   ",
      "relative-home",
      join(directory, "other-home"),
      undefined,
    ]) {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        CDX_CHORES_CODEX_PATH: executable,
        CDX_TEST_ENV_MARKER: "retained",
      };
      delete env.CODEX_HOME;
      if (home !== undefined) env.CODEX_HOME = home;
      const result = JSON.parse(
        execFileSync(process.execPath, ["--eval", source], {
          cwd: REPO_ROOT,
          env,
          encoding: "utf8",
          timeout: 10_000,
        }),
      );
      expect(result.sdk).toEqual({ home: home ?? null, marker: "retained" });
      expect(result.discovery).toEqual(result.sdk);
      expect(result.unchanged).toBe(true);
    }
  });
});
