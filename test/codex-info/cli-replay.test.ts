import { describe, expect, test } from "bun:test";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

const evidencePath = join(REPO_ROOT, "test/codex-info/fixtures/cli-0.153.4-protocol.json");

interface ProviderConfigOverride {
  model_provider: string;
  model_providers: Record<string, { name: string }>;
}

async function replay(
  run: (
    invoke: (
      args: string[],
      failure?: string,
      providerConfig?: ProviderConfigOverride,
    ) => SpawnSyncReturns<string>,
  ) => void,
) {
  await withTempFixtureDir("codex-cli-replay", async (directory) => {
    const server = join(directory, "server.cjs");
    await writeFile(
      server,
      `#!/usr/bin/env node
const evidence = JSON.parse(require("node:fs").readFileSync(process.env.EVIDENCE_FILE,"utf8"));
const {createInterface} = require("node:readline");
createInterface({input:process.stdin}).on("line", line => {
 const {id,method,params} = JSON.parse(line);
 const send = result => console.log(JSON.stringify({id,result}));
 if (method === "initialized") return;
 if (method === process.env.FAIL_METHOD) {
   console.log(JSON.stringify({id,error:{code:-1,message:"private-error-payload"}})); return;
 }
 if (method === "initialize") {
   const recorded = evidence.homeCases.existingRelative;
   send({...recorded, codexHome:process.env.CODEX_HOME, userAgent:recorded.userAgent.replaceAll("cdx_chores_protocol_probe",params.clientInfo.name)});
 } else if (method === "config/read") {
   const recorded = evidence.configRead.custom;
   send({config:{model:recorded.model,model_provider:recorded.model_provider,model_providers:Object.fromEntries(recorded.providerIds.map(id => [id,{name:"Probe proxy",experimental_bearer_token:"private-secret"}])),...JSON.parse(process.env.PROVIDER_CONFIG_OVERRIDE)},origins:recorded.origins,layers:null});
 } else if (method === "model/list") {
   const start=Number(params.cursor ?? 0);
   const page=evidence.modelList.pages[start/2];
   send({data:evidence.modelList.models.slice(start,start+page.count),nextCursor:page.nextCursor});
 } else { process.exit(2); }
});
`,
    );
    await chmod(server, 0o755);
    run((args, failure, providerConfig) =>
      spawnSync(process.execPath, [join(REPO_ROOT, "src/bin.ts"), ...args], {
        cwd: directory,
        env: {
          ...process.env,
          CODEX_HOME: directory,
          CDX_CHORES_CODEX_PATH: server,
          EVIDENCE_FILE: evidencePath,
          FAIL_METHOD: failure ?? "",
          PROVIDER_CONFIG_OVERRIDE: JSON.stringify(providerConfig ?? {}),
        },
        encoding: "utf8",
        timeout: 10_000,
      }),
    );
  });
}

describe("Codex information CLI with recorded protocol projections", () => {
  test("always-on replay consumes the recorded catalog through the real CLI pipeline", async () => {
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    await replay((invoke) => {
      for (const command of [
        ["codex-info"],
        ["codex-info", "models"],
        ["codex-info", "providers"],
      ]) {
        const result = invoke([...command, "--json"]);
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        const report = JSON.parse(result.stdout);
        expect(report.context.codexVersion).toBe(evidence.version.replace("codex-cli ", ""));
        expect(report.configured.provider).toBe(evidence.configRead.custom.model_provider);
        expect(report.providers.map((provider: { id: string }) => provider.id)).toEqual(
          evidence.configRead.custom.providerIds,
        );
        expect(result.stdout).not.toContain("private-secret");
        if (command[1] === "providers") {
          expect(report.models).toBeNull();
          expect(report.catalogSource).toBeNull();
        } else {
          expect(report.models.map((model: { id: string }) => model.id)).toEqual(
            evidence.modelList.models.map((model: { id: string }) => model.id),
          );
          expect(report.models[0].supportedReasoningEfforts).toEqual(
            evidence.modelList.models[0].supportedReasoningEfforts.map(
              (effort: { reasoningEffort: string; description: string }) => ({
                effort: effort.reasoningEffort,
                description: effort.description,
              }),
            ),
          );
        }
      }
      const summary = invoke(["codex-info"]);
      expect(summary.status).toBe(0);
      expect(summary.stdout).toContain("Configured provider: probe_proxy");
      const details = invoke(["codex-info", "models", "--details"]);
      expect(details.status).toBe(0);
      expect(details.stdout).toContain("Invocation context:");
      expect(details.stdout).toContain("Catalog reasoning default:");
      expect(details.stdout).not.toContain("Helper reasoning default:");
      expect(details.stdout).not.toContain("Provider coverage:");
      const providers = invoke(["codex-info", "providers", "--details"]);
      expect(providers.status).toBe(0);
      expect(providers.stdout).toContain(
        "Source: configured definitions only; built-ins not enumerated.",
      );
      expect(providers.stdout).toContain("probe_proxy [configured]");
      expect(providers.stdout).not.toContain("Configured model:");
      expect(providers.stdout).not.toContain("reasoning");
    });
  });
  test("multiple provider definitions retain builtin selection without inventing catalog scope", async () => {
    await replay((invoke) => {
      const catalogs: unknown[] = [];
      for (const selected of ["openai", "company-proxy"]) {
        const providerConfig = {
          model_provider: selected,
          model_providers: {
            "local-gateway": { name: "Local gateway" },
            "company-proxy": { name: "Company proxy" },
          },
        };
        const result = invoke(["codex-info", "providers", "--json"], "model/list", providerConfig);
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        const report = JSON.parse(result.stdout);
        expect(report.configured.provider).toBe(selected);
        expect(report.providerCoverage).toBe("configured-only");
        expect(report.providers).toEqual([
          {
            id: "company-proxy",
            displayName: "Company proxy",
            sources: ["configured"],
            isConfigured: selected === "company-proxy",
          },
          {
            id: "local-gateway",
            displayName: "Local gateway",
            sources: ["configured"],
            isConfigured: false,
          },
        ]);
        expect(report.models).toBeNull();
        expect(report.catalogSource).toBeNull();

        for (const outputOptions of [[], ["--details"]]) {
          const human = invoke(
            ["codex-info", "providers", ...outputOptions],
            "model/list",
            providerConfig,
          );
          expect(human.status).toBe(0);
          expect(human.stderr).toBe("");
          expect(human.stdout).toContain(`Configured provider: ${selected}`);
          expect(human.stdout).toContain(
            "Source: configured definitions only; built-ins not enumerated.",
          );
          const providerRows = human.stdout
            .split("\n")
            .filter((line) => /^(openai|company-proxy|local-gateway)( |$)/.test(line));
          expect(providerRows).toEqual([
            selected === "company-proxy" ? "company-proxy [configured]" : "company-proxy",
            "local-gateway",
          ]);
          expect(human.stdout.match(/\[configured\]/g) ?? []).toHaveLength(
            selected === "company-proxy" ? 1 : 0,
          );
          if (selected === "openai") {
            expect(human.stdout).toContain(
              "Configured provider openai is unlisted; absence does not imply lack of support.",
            );
          } else {
            expect(human.stdout).not.toContain("is unlisted");
          }
          if (outputOptions.length > 0) {
            expect(human.stdout).toContain("  Display name: Company proxy");
            expect(human.stdout).toContain("  Display name: Local gateway");
          } else {
            expect(human.stdout).not.toContain("Display name:");
          }
        }

        const models = invoke(["codex-info", "models", "--json"], undefined, providerConfig);
        expect(models.status).toBe(0);
        expect(models.stderr).toBe("");
        const modelReport = JSON.parse(models.stdout);
        expect(modelReport.configured.provider).toBe(selected);
        expect(modelReport.catalogSource).toBe("codex");
        expect(modelReport.catalogScope).toBe("picker-visible");
        expect(modelReport.models.length).toBeGreaterThan(0);
        catalogs.push(modelReport.models);
      }
      expect(catalogs[0]).toEqual(catalogs[1]);
    });
  });
  test("required read failures never emit partial reports; providers ignore catalog availability", async () => {
    await replay((invoke) => {
      for (const failure of ["config/read", "model/list"]) {
        const result = invoke(["codex-info", "--json"], failure);
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("Codex discovery request failed");
        expect(result.stderr).not.toContain("private-error-payload");
      }
      const providers = invoke(["codex-info", "providers", "--json"], "model/list");
      expect(providers.status).toBe(0);
      expect(JSON.parse(providers.stdout).providerCoverage).toBe("configured-only");
    });
  });
});
