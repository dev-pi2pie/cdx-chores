import { describe, expect, test } from "bun:test";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";
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
    await withTempFixtureDir("codex-live-protocol", async (root) => {
      const home = join(root, "home");
      const tmp = join(root, "tmp");
      const cwd = join(root, "project");
      const defaultHome = join(home, ".codex");
      const customHome = join(root, "custom-codex");
      const whitespaceHome = join(cwd, "   ");
      for (const directory of [home, tmp, cwd, defaultHome, customHome, whitespaceHome]) {
        await mkdir(directory, { recursive: true });
      }
      const linkHome = join(root, "linked-codex");
      await symlink(customHome, linkHome);
      // Explicit allowlist: never forward API keys, account state, or the user's home.
      const environment: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        HOME: home,
        TMPDIR: tmp,
        XDG_CONFIG_HOME: join(root, "xdg-config"),
        XDG_DATA_HOME: join(root, "xdg-data"),
        XDG_CACHE_HOME: join(root, "xdg-cache"),
      };
      const executable = join(REPO_ROOT, "node_modules", ".bin", "codex");
      const versionResult = Bun.spawnSync([executable, "--version"], {
        cwd,
        env: environment,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(versionResult.exitCode).toBe(0);
      const version = Buffer.from(versionResult.stdout).toString().trim();
      const evidence: Record<string, unknown> = {
        version,
        requests: {
          initialize: initializeParams,
          initialized: { method: "initialized" },
          configRead: { cwd: "<fixture>/project", includeLayers: false },
          firstModelPage: { includeHidden: false, limit: 2 },
        },
      };
      const sanitize = (value: unknown): unknown =>
        JSON.parse(
          JSON.stringify(value)
            .replaceAll(root, "<fixture>")
            .replace(/\(Mac OS [^)]*\)/g, "(<platform-version-and-architecture>)"),
        );

      async function probe(codexHome: string | undefined, listModels = false) {
        const env = {
          ...environment,
          ...(codexHome === undefined ? {} : { CODEX_HOME: codexHome }),
        };
        const client = new LiveProtocolClient(executable, cwd, env);
        try {
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
        } finally {
          await client.close();
        }
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
      evidence.homeCases = sanitize({
        unset: unset.initialization,
        empty: empty.initialization,
        existingRelative: relative.initialization,
        existingWhitespace: whitespace.initialization,
        symlink: linked.initialization,
        missingWhitespace: { requestedHome: "  ", exitCode: 1 },
      });

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
      evidence.configRead = sanitize({
        omitted: {
          model: unset.configuration.config.model,
          model_provider: unset.configuration.config.model_provider,
          origins: unset.configuration.origins,
        },
        custom: {
          model: custom.configuration.config.model,
          model_provider: custom.configuration.config.model_provider,
          providerIds: Object.keys(custom.configuration.config.model_providers as object),
          origins: custom.configuration.origins,
        },
      });
      evidence.modelList = {
        pages: custom.pages,
        identicalCatalogAcrossTheseTwoConfigurations: true,
        models: custom.models.map(
          ({ id, model, isDefault, supportedReasoningEfforts, defaultReasoningEffort }) => ({
            id,
            model,
            isDefault,
            supportedReasoningEfforts,
            defaultReasoningEffort,
          }),
        ),
      };
      await mkdir(join(cwd, ".git"));
      await mkdir(join(cwd, ".codex"));
      await writeFile(join(cwd, ".codex", "config.toml"), 'model = "project-probe-model"\n');
      await writeFile(
        join(customHome, "config.toml"),
        `model = "user-probe-model"\n[projects.${JSON.stringify(cwd)}]\ntrust_level = "trusted"\n`,
      );
      const project = await probe(customHome);
      expect(project.configuration.config.model).toBe("project-probe-model");
      evidence.trustedProjectConfig = sanitize({
        model: project.configuration.config.model,
        origins: project.configuration.origins,
      });
      if (process.env.CDX_CHORES_UPDATE_CODEX_DISCOVERY_EVIDENCE === "1") {
        expect(version).toBe("codex-cli 0.153.4");
        const fixtures = join(REPO_ROOT, "test", "codex-info", "fixtures");
        await mkdir(fixtures, { recursive: true });
        await writeFile(
          join(fixtures, "cli-0.153.4-protocol.json"),
          JSON.stringify(evidence, null, 2) + "\n",
        );
      }
    });
  }, 120_000);
});
