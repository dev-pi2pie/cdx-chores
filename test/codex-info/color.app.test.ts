import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

import type { CodexInfoView } from "../../src/adapters/codex/discovery/types";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";
import { discovery } from "./color-discovery";

describe("Codex information presentation color boundaries", () => {
  test("real CLI honors NO_COLOR, empty NO_COLOR, and --no-color with eligible output streams", async () => {
    await withTempFixtureDir("codex-color-policy", async (directory) => {
      const server = join(directory, "server.cjs");
      await writeFile(
        server,
        `#!/usr/bin/env node
const {createInterface} = require("node:readline");
const fixture = ${JSON.stringify(discovery)};
createInterface({input:process.stdin}).on("line", line => {
 const {id,method} = JSON.parse(line);
 if (method === "initialized") return;
 const result = method === "initialize"
   ? {userAgent:"cdx_chores/0.153.4",codexHome:process.env.CODEX_HOME}
   : method === "config/read" ? {config:fixture.config,origins:{},layers:null}
   : {data:fixture.models,nextCursor:null};
 console.log(JSON.stringify({id,result}));
});
`,
      );
      await chmod(server, 0o755);
      const runner = join(REPO_ROOT, "test/codex-info/fixtures/color-cli-runner.mjs");
      const baselineEnv: NodeJS.ProcessEnv = {
        ...process.env,
        HOME: directory,
        CODEX_HOME: directory,
        CDX_CHORES_CODEX_PATH: server,
      };
      delete baselineEnv.NO_COLOR;
      delete baselineEnv.FORCE_COLOR;
      delete baselineEnv.CASE_FLAG;
      delete baselineEnv.CDX_CHORES_COLOR_TEST_CLI_MODULE;
      const invoke = (extra: NodeJS.ProcessEnv) => {
        const result = spawnSync(process.execPath, [runner], {
          cwd: directory,
          env: { ...baselineEnv, ...extra },
          encoding: "utf8",
          timeout: 20_000,
        });
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        return JSON.parse(result.stdout) as {
          view: CodexInfoView;
          format: string;
          stdout: string;
          stderr: string;
        }[];
      };
      const baseline = invoke({ CASE_FLAG: "0" });
      for (const overrides of [{ NO_COLOR: "1" }, { NO_COLOR: "" }, { CASE_FLAG: "1" }]) {
        const disabled = invoke(overrides);
        expect(disabled).toHaveLength(9);
        for (const [index, item] of disabled.entries()) {
          expect(item.stderr).toBe("");
          expect(item.stdout).not.toContain("\x1b");
          const original = baseline[index]!;
          expect(original.stderr).toBe("");
          if (item.format === "json") {
            expect(original.stdout).not.toContain("\x1b");
            expect(JSON.parse(item.stdout)).toEqual(JSON.parse(original.stdout));
          } else {
            expect(original.stdout).toContain("\x1b[");
            expect(item.stdout).toBe(stripVTControlCharacters(original.stdout));
          }
        }
      }
    });
  }, 30_000);
});
