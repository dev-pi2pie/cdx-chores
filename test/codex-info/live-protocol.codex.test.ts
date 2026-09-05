import { describe, expect, test } from "bun:test";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CodexDiscovery } from "../../src/adapters/codex/discovery/types";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { lifecycleDiagnostic, withLiveCodexFixture } from "./live-fixture";
import { LiveProtocolClient } from "./live-protocol-client";

const enabled = process.env.CDX_CHORES_RUN_CODEX_DISCOVERY_PROBE === "1";
const initializeParams = {
  clientInfo: { name: "cdx_chores_protocol_probe", title: "Isolated protocol probe", version: "1" },
  capabilities: { experimentalApi: false },
};

type Initialization = {
  userAgent: string;
  codexHome: string;
  platformFamily: string;
  platformOs: string;
};
type Configuration = {
  config: { model?: string | null; model_provider?: string | null; model_providers?: unknown };
  origins: unknown;
};
type Model = {
  id: string;
  model: string;
  isDefault: boolean;
  supportedReasoningEfforts: unknown[];
  defaultReasoningEffort: string;
};
type ModelPage = { data: Model[]; nextCursor: string | null };

describe.skipIf(!enabled)("real Codex discovery protocol (isolated, opt-in)", () => {
  test("records location resolution, config origins, and provider-independent catalog evidence", async () => {
    await withLiveCodexFixture(async ({ root, cwd, env: environment, start, close }) => {
      const home = join(root, "home");
      const defaultHome = join(home, ".codex");
      const customHome = join(root, "custom-codex");
      const whitespaceHome = join(cwd, "   ");
      for (const directory of [defaultHome, customHome, whitespaceHome]) {
        await mkdir(directory, { recursive: true });
      }
      const linkHome = join(root, "linked-codex");
      await symlink(customHome, linkHome);
      const executable = join(REPO_ROOT, "node_modules", ".bin", "codex");
      const versionResult = await start({
        executable,
        args: ["--version"],
        timeoutMs: 5000,
      }).completion;
      expect(versionResult.exitCode, lifecycleDiagnostic(versionResult)).toBe(0);
      expect(versionResult.ok, lifecycleDiagnostic(versionResult)).toBe(true);
      expect(versionResult.stdout.trim()).toMatch(/^codex-cli \d+\.\d+\.\d+$/);

      async function probe(codexHome: string | undefined, listModels = false) {
        const env = {
          ...environment,
          ...(codexHome === undefined ? {} : { CODEX_HOME: codexHome }),
        };
        const owned = start({ executable, args: ["app-server"], env });
        const client = new LiveProtocolClient(executable, cwd, env, {
          child: owned.child,
          close: () => close(owned),
        });
        const readProtocol = async () => {
          const initialization = (await client.request(
            "initialize",
            initializeParams,
          )) as Initialization;
          client.notify("initialized");
          const configuration = (await client.request("config/read", {
            cwd,
            includeLayers: false,
          })) as Configuration;
          expect(initialization.codexHome).toBeString();
          expect(configuration.origins).toBeDefined();
          const models: Model[] = [];
          const pages: Array<{ count: number; nextCursor: string | null }> = [];
          if (listModels) {
            let cursor: string | undefined;
            do {
              const page = (await client.request("model/list", {
                includeHidden: false,
                limit: 2,
                ...(cursor === undefined ? {} : { cursor }),
              })) as ModelPage;
              expect(Array.isArray(page.data)).toBe(true);
              models.push(...page.data);
              pages.push({ count: page.data.length, nextCursor: page.nextCursor });
              if (pages.length > 20) throw new Error("Unexpected probe pagination length");
              cursor = page.nextCursor ?? undefined;
            } while (cursor !== undefined);
          }
          return { initialization, configuration, models, pages };
        };
        let value: Awaited<ReturnType<typeof readProtocol>> | undefined;
        let failed = false;
        let failure: unknown;
        try {
          value = await readProtocol();
        } catch (error) {
          failed = true;
          failure = error;
        }
        try {
          await client.close();
        } catch (cleanupError) {
          if (failed) {
            throw new AggregateError([failure, cleanupError], "Protocol and cleanup failed.");
          }
          throw cleanupError;
        }
        if (failed) throw failure;
        return value!;
      }

      const unset = await probe(undefined, true);
      const empty = await probe("");
      const relative = await probe("../custom-codex");
      const whitespace = await probe("   ");
      const linked = await probe(linkHome);
      await expect(probe("  ")).rejects.toThrow("Probe exited: 1");
      expect(unset.initialization.codexHome).toBe(await realpath(defaultHome));
      expect(empty.initialization.codexHome).toBe(await realpath(defaultHome));
      expect(relative.initialization.codexHome).toBe(await realpath(customHome));
      expect(whitespace.initialization.codexHome).toBe(await realpath(whitespaceHome));
      expect(linked.initialization.codexHome).toBe(await realpath(customHome));
      await writeFile(
        join(customHome, "config.toml"),
        'model = "probe-model"\nmodel_provider = "probe_proxy"\n[model_providers.probe_proxy]\nname = "Probe proxy"\nbase_url = "http://127.0.0.1:1/v1"\nwire_api = "responses"\n',
      );
      const custom = await probe(customHome, true);
      expect(custom.configuration.config.model).toBe("probe-model");
      expect(custom.configuration.config.model_provider).toBe("probe_proxy");
      expect(custom.configuration.config.model_providers).toHaveProperty("probe_proxy");
      expect(custom.models.map((model) => model.id)).toEqual(unset.models.map((model) => model.id));
      expect(new Set(custom.models.map((model) => model.id)).size).toBe(custom.models.length);
      await mkdir(join(cwd, ".git"));
      await mkdir(join(cwd, ".codex"));
      await writeFile(join(cwd, ".codex", "config.toml"), 'model = "project-probe-model"\n');
      await writeFile(
        join(customHome, "config.toml"),
        `model = "user-probe-model"\n[projects.${JSON.stringify(cwd)}]\ntrust_level = "trusted"\n`,
      );
      const project = await probe(customHome);
      expect(project.configuration.config.model).toBe("project-probe-model");
    });
  }, 120_000);

  test("production discovery adapter reads isolated configuration and the live model catalog", async () => {
    await withLiveCodexFixture(async ({ root, cwd, env, start }) => {
      const codexHome = join(root, "home", ".codex");
      await writeFile(join(codexHome, "config.toml"), 'model = "adapter-probe-model"\n');
      for (const view of ["summary", "models", "providers"] as const) {
        const result = await start({
          executable: process.execPath,
          args: [join(REPO_ROOT, "test/codex-info/fixtures/live-discovery.ts"), view],
          env: { ...env, CODEX_HOME: codexHome },
        }).completion;
        expect(result.ok, lifecycleDiagnostic(result)).toBe(true);
        const discovery = JSON.parse(result.stdout) as CodexDiscovery;
        expect(discovery.context.cwd).toBe(cwd);
        expect(discovery.context.codexHome).toBe(await realpath(codexHome));
        expect(discovery.context.codexHomeSource).toBe("environment");
        expect(discovery.context.codexVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(discovery.config.model).toBe("adapter-probe-model");
        if (view === "providers") {
          expect(discovery.models).toBeNull();
        } else {
          expect(Array.isArray(discovery.models)).toBe(true);
          expect(discovery.models!.length).toBeGreaterThan(0);
        }
      }
    });
  }, 120_000);
});
