import { registerFixtureOutput } from "../../scripts/testing/fixtures/fixture-exports.ts";
import { describe, expect, test } from "bun:test";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CodexDiscovery } from "../../src/adapters/codex/discovery/types";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { lifecycleDiagnostic, withLiveCodexFixture } from "./live-fixture";
import { LiveProtocolClient } from "./live-protocol-client";

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

describe("real Codex discovery protocol (isolated)", () => {
  test("records location resolution, config origins, and provider-independent catalog evidence", async () => {
    await withLiveCodexFixture(async ({ root, cwd, env: environment, start, close }) => {
      const evidencePath = join(root, "protocol-checks.json");
      registerFixtureOutput(root, {
        source: evidencePath,
        name: "protocol-checks.json",
        kind: "diagnostic",
        required: true,
      });
      const evidence = {
        plannedRequests: ["initialize", "config/read", "model/list"],
        completedRequests: [] as string[],
        checks: [] as Array<{ check: string; passed: boolean }>,
      };
      await writeFile(evidencePath, JSON.stringify(evidence));
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
          evidence.completedRequests.push("initialize");
          await writeFile(evidencePath, JSON.stringify(evidence));
          client.notify("initialized");
          const configuration = (await client.request("config/read", {
            cwd,
            includeLayers: false,
          })) as Configuration;
          evidence.completedRequests.push("config/read");
          await writeFile(evidencePath, JSON.stringify(evidence));
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
              evidence.completedRequests.push("model/list");
              await writeFile(evidencePath, JSON.stringify(evidence));
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
      evidence.checks.push(
        {
          check: "default-location",
          passed: unset.initialization.codexHome === (await realpath(defaultHome)),
        },
        {
          check: "empty-location",
          passed: empty.initialization.codexHome === (await realpath(defaultHome)),
        },
        {
          check: "relative-location",
          passed: relative.initialization.codexHome === (await realpath(customHome)),
        },
        {
          check: "whitespace-location",
          passed: whitespace.initialization.codexHome === (await realpath(whitespaceHome)),
        },
        {
          check: "linked-location",
          passed: linked.initialization.codexHome === (await realpath(customHome)),
        },
      );
      await writeFile(evidencePath, JSON.stringify(evidence));
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
      evidence.checks.push({
        check: "provider-independent-catalog",
        passed:
          JSON.stringify(custom.models.map((model) => model.id)) ===
          JSON.stringify(unset.models.map((model) => model.id)),
      });
      await writeFile(evidencePath, JSON.stringify(evidence));
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
      evidence.checks.push({
        check: "project-configuration-precedence",
        passed: project.configuration.config.model === "project-probe-model",
      });
      await writeFile(evidencePath, JSON.stringify(evidence));
      expect(project.configuration.config.model).toBe("project-probe-model");
    });
  }, 120_000);

  test("production discovery adapter reads isolated configuration and the live model catalog", async () => {
    await withLiveCodexFixture(async ({ root, cwd, env, start }) => {
      const evidencePath = join(root, "adapter-checks.json");
      registerFixtureOutput(root, {
        source: evidencePath,
        name: "adapter-checks.json",
        kind: "diagnostic",
        required: true,
      });
      const evidence = {
        plannedViews: ["summary", "models", "providers"],
        checks: [] as Array<{
          view: string;
          stopped: boolean;
          passed: boolean;
          modelCount: number | null;
        }>,
      };
      await writeFile(evidencePath, JSON.stringify(evidence));
      const codexHome = join(root, "home", ".codex");
      await writeFile(join(codexHome, "config.toml"), 'model = "adapter-probe-model"\n');
      for (const view of ["summary", "models", "providers"] as const) {
        const result = await start({
          executable: process.execPath,
          args: [join(REPO_ROOT, "test/codex-info/fixtures/live-discovery.ts"), view],
          env: { ...env, CODEX_HOME: codexHome },
        }).completion;
        evidence.checks.push({
          view,
          stopped: result.stopped,
          passed: result.ok,
          modelCount: null,
        });
        await writeFile(evidencePath, JSON.stringify(evidence));
        expect(result.ok, lifecycleDiagnostic(result)).toBe(true);
        const discovery = JSON.parse(result.stdout) as CodexDiscovery;
        evidence.checks[evidence.checks.length - 1]!.modelCount = discovery.models?.length ?? null;
        await writeFile(evidencePath, JSON.stringify(evidence));
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
