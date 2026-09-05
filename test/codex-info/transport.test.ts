import { describe, expect, test } from "bun:test";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { discoverCodexInfo } from "../../src/adapters/codex/discovery";
import { resolveDiscoveryExecutable } from "../../src/adapters/codex/discovery/executable";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

async function withServer(
  behavior: string,
  run: (env: NodeJS.ProcessEnv, cwd: string, log: string) => Promise<void>,
): Promise<void> {
  await withTempFixtureDir("codex-info-transport", async (cwd) => {
    const executable = join(cwd, "server.cjs");
    const log = join(cwd, "requests.jsonl");
    await writeFile(
      executable,
      String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const readline = require("node:readline");
const log = process.env.FIXTURE_LOG;
fs.writeFileSync(log + ".pid", String(process.pid));
const send = (id, result) => process.stdout.write(JSON.stringify({ id, result }) + "\n");
let page = 0;
${behavior.includes("resistTermination") ? 'process.on("SIGTERM", () => {});' : ""}
readline.createInterface({ input: process.stdin }).on("line", async (line) => {
  const request = JSON.parse(line);
  fs.appendFileSync(log, line + "\n");
  const { id, method, params } = request;
  ${behavior}
  if (method === "initialize") send(id, { userAgent: "cdx_chores/0.153.4 (test)", codexHome: process.env.CODEX_HOME || "/synthetic/default" });
  if (method === "config/read") send(id, { config: { model: process.env.FIXTURE_MODEL || null, model_provider: "custom", model_providers: { custom: { name: "Custom", secret: "hidden" } }, forwarded: process.env.UNRELATED_VALUE, launchCwd: process.cwd() } });
  if (method === "model/list") send(id, { data: [{ id: "model-" + (++page) }], nextCursor: page === 1 ? "page-two" : null });
});
setInterval(() => {}, 1000);
`,
    );
    await chmod(executable, 0o755);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CDX_CHORES_CODEX_PATH: executable,
      FIXTURE_LOG: log,
    };
    delete env.CODEX_HOME;
    await run(env, cwd, log);
    const pid = Number(await readFile(log + ".pid", "utf8").catch(() => "0"));
    if (pid) expect(() => process.kill(pid, 0)).toThrow();
  });
}

describe("Codex information discovery transport", () => {
  test("reads all model pages in order using the invocation directory", async () => {
    await withServer("", async (env, cwd, log) => {
      env.UNRELATED_VALUE = "preserved";
      const result = await discoverCodexInfo({ cwd, env, view: "summary" });
      expect(result.context).toEqual({
        cwd,
        codexVersion: "0.153.4",
        codexHome: "/synthetic/default",
        codexHomeSource: "default",
      });
      expect(result.config.forwarded).toBe("preserved");
      expect(result.config.launchCwd).toBe(cwd);
      expect(result.models).toEqual([{ id: "model-1" }, { id: "model-2" }]);
      const requests = (await readFile(log, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(requests.map((request) => request.method)).toEqual([
        "initialize",
        "initialized",
        "config/read",
        "model/list",
        "model/list",
      ]);
      expect(requests[2].params).toEqual({ cwd, includeLayers: false });
      expect(requests[3].params).toEqual({ includeHidden: false });
      expect(requests[4].params).toEqual({ includeHidden: false, cursor: "page-two" });
    });
  });

  test("providers never calls model/list, including when it would fail", async () => {
    await withServer(
      'if (method === "model/list") { process.stdout.write(JSON.stringify({ id, error: { message: "SECRET" } }) + "\\n"); return; }',
      async (env, cwd, log) => {
        const result = await discoverCodexInfo({ cwd, env, view: "providers" });
        expect(result.models).toBeNull();
        expect(await readFile(log, "utf8")).not.toContain("model/list");
      },
    );
  });

  test("snapshots the environment and does not retain homes across invocations", async () => {
    await withServer("", async (env, cwd) => {
      env.CODEX_HOME = "/synthetic/first";
      const firstPromise = discoverCodexInfo({ cwd, env, view: "providers" });
      env.CODEX_HOME = "/synthetic/second";
      const first = await firstPromise;
      const second = await discoverCodexInfo({ cwd, env, view: "providers" });
      expect(first.context.codexHome).toBe("/synthetic/first");
      expect(second.context.codexHome).toBe("/synthetic/second");
      expect(first.context.codexHomeSource).toBe("environment");
      expect(second.context.codexHomeSource).toBe("environment");
    });
  });

  test.each(["", "relative-home", "   "])(
    "classifies the unmodified environment value %j using authoritative home",
    async (home) => {
      await withServer(
        'if (method === "initialize") { send(id, { userAgent: "cdx_chores/0.153.4", codexHome: "/synthetic/resolved" }); return; }',
        async (env, cwd) => {
          env.CODEX_HOME = home;
          const result = await discoverCodexInfo({ cwd, env, view: "providers" });
          expect(result.context.codexHome).toBe("/synthetic/resolved");
          expect(result.context.codexHomeSource).toBe(home === "" ? "default" : "environment");
        },
      );
    },
  );

  test("accepts fragmented UTF-8 responses and unrelated notifications", async () => {
    await withServer(
      'if (method === "config/read") { const bytes = Buffer.from(JSON.stringify({ id, result: { config: { model: "模型" } } }) + "\\n"); process.stdout.write(JSON.stringify({ method: "notice", params: {} }) + "\\n"); for (const byte of bytes) process.stdout.write(Buffer.from([byte])); return; }',
      async (env, cwd) => {
        const result = await discoverCodexInfo({ cwd, env, view: "providers" });
        expect(result.config.model).toBe("模型");
      },
    );
  });

  test.each([
    ["malformed JSON", 'process.stdout.write("SECRET-invalid\\n"); return;'],
    ["invalid response", "send(id + 1, {}); return;"],
    [
      "request failed",
      'process.stderr.write("SECRET"); process.stdout.write(JSON.stringify({ id, error: { message: "SECRET" } }) + "\\n"); return;',
    ],
    ["invalid configuration", "send(id, { config: [] }); return;"],
    ["response limit", 'process.stdout.write("x".repeat(1024 * 1024 + 1)); return;'],
    ["ended unexpectedly", "process.exit(0);"],
  ])("fails safely on %s and reaps the child", async (expected, code) => {
    await withServer(`if (method === "config/read") { ${code} }`, async (env, cwd) => {
      let message = "";
      try {
        await discoverCodexInfo({ cwd, env, view: "providers" });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain(expected);
      expect(message).not.toContain("SECRET");
      expect(message).not.toContain(cwd);
    });
  });

  test.each([null, "relative", 4])(
    "rejects invalid effective home metadata %j",
    async (codexHome) => {
      await withServer(
        `if (method === "initialize") { send(id, { userAgent: "cdx_chores/0.153.4", codexHome: ${JSON.stringify(codexHome)} }); return; }`,
        async (env, cwd) => {
          await expect(discoverCodexInfo({ cwd, env, view: "providers" })).rejects.toThrow(
            "valid absolute Codex home",
          );
        },
      );
    },
  );

  test("rejects repeated model cursors without returning partial configuration", async () => {
    await withServer(
      'if (method === "model/list") { send(id, { data: [], nextCursor: "same" }); return; }',
      async (env, cwd) => {
        await expect(discoverCodexInfo({ cwd, env, view: "models" })).rejects.toThrow("repeated");
      },
    );
  });

  test("bounds model pages", async () => {
    await withServer(
      'if (method === "model/list") { send(id, { data: [], nextCursor: String(++page) }); return; }',
      async (env, cwd) => {
        await expect(discoverCodexInfo({ cwd, env, view: "models" })).rejects.toThrow("page limit");
      },
    );
  });

  test("rejects trailing malformed messages in the final response chunk", async () => {
    await withServer(
      'if (method === "config/read") { process.stdout.write(JSON.stringify({ id, result: { config: {} } }) + "\\nSECRET-invalid\\n"); return; }',
      async (env, cwd) => {
        await expect(discoverCodexInfo({ cwd, env, view: "providers" })).rejects.toThrow(
          "malformed JSON",
        );
      },
    );
  });

  test("bounds model count", async () => {
    await withServer(
      'if (method === "model/list") { send(id, { data: Array(10001).fill({ id: "model" }), nextCursor: null }); return; }',
      async (env, cwd) => {
        await expect(discoverCodexInfo({ cwd, env, view: "models" })).rejects.toThrow(
          "model count limit",
        );
      },
    );
  });

  test("bounds cumulative notification output", async () => {
    await withServer(
      'if (method === "config/read") { const line = JSON.stringify({ method: "notice", params: { text: "x".repeat(60000) } }) + "\\n"; for (let i = 0; i < 150; i++) process.stdout.write(line); return; }',
      async (env, cwd) => {
        await expect(discoverCodexInfo({ cwd, env, view: "providers" })).rejects.toThrow(
          "output limit",
        );
      },
    );
  });

  test("rejects invalid model page metadata", async () => {
    await withServer(
      'if (method === "model/list") { send(id, { data: [], nextCursor: 42 }); return; }',
      async (env, cwd) => {
        await expect(discoverCodexInfo({ cwd, env, view: "models" })).rejects.toThrow(
          "invalid model metadata",
        );
      },
    );
  });

  test("accepts an empty successful catalog", async () => {
    await withServer(
      'if (method === "model/list") { send(id, { data: [], nextCursor: null }); return; }',
      async (env, cwd) => {
        expect((await discoverCodexInfo({ cwd, env, view: "models" })).models).toEqual([]);
      },
    );
  });

  test("rejects cancellation before executable resolution", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      discoverCodexInfo({
        cwd: process.cwd(),
        view: "providers",
        signal: controller.signal,
        env: { CDX_CHORES_CODEX_PATH: "/missing-private-path" },
      }),
    ).rejects.toThrow("cancelled");
  });

  test("deadline covers pagination and forcibly reaps a resistant child", async () => {
    await withServer(
      '// resistTermination\nif (method === "model/list") return;',
      async (env, cwd, log) => {
        await expect(
          discoverCodexInfo({ cwd, env, view: "models", timeoutMs: 1000 }),
        ).rejects.toThrow("timed out");
        expect(await readFile(log, "utf8")).toContain("model/list");
      },
    );
  });

  test("cancellation terminates the owned child", async () => {
    await withServer('if (method === "config/read") return;', async (env, cwd) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 150);
      try {
        await expect(
          discoverCodexInfo({ cwd, env, view: "providers", signal: controller.signal }),
        ).rejects.toThrow("cancelled");
      } finally {
        clearTimeout(timer);
      }
    });
  });

  test("sanitizes missing executable failures", async () => {
    await expect(
      discoverCodexInfo({
        cwd: process.cwd(),
        env: { CDX_CHORES_CODEX_PATH: "/missing-private-path" },
        view: "providers",
      }),
    ).rejects.toThrow("Unable to start");
  });

  test("resolves the SDK-installed native binary and trims executable override only", () => {
    const env = { ...process.env };
    delete env.CDX_CHORES_CODEX_PATH;
    expect(resolveDiscoveryExecutable(env)).toMatch(/vendor.+codex(?:\.exe)?$/);
    expect(
      resolveDiscoveryExecutable({
        CDX_CHORES_CODEX_PATH: " custom-command ",
        CODEX_HOME: " home ",
      }),
    ).toBe("custom-command");
  });
});
