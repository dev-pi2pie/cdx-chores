import { isAbsolute } from "node:path";

import { resolveDiscoveryExecutable } from "./executable";
import { DiscoveryTransport, isRecord } from "./transport";
import type { CodexDiscovery, CodexDiscoveryOptions } from "./types";

const MAX_MODEL_PAGES = 100;
const MAX_MODELS = 10_000;

export async function discoverCodexInfo(options: CodexDiscoveryOptions): Promise<CodexDiscovery> {
  const started = Date.now();
  const env = { ...(options.env ?? process.env) };
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("Codex discovery deadline must be positive.");
  if (options.signal?.aborted) throw new Error("Codex discovery was cancelled.");
  const executable = resolveDiscoveryExecutable(env);
  const remaining = timeoutMs - (Date.now() - started);
  if (remaining <= 0) throw new Error("Codex discovery timed out.");
  const transport = new DiscoveryTransport(executable, options.cwd, env, remaining, options.signal);
  try {
    const initialized = await transport.request("initialize", {
      clientInfo: { name: "cdx_chores", title: "cdx-chores", version: "1" },
      capabilities: { experimentalApi: false },
    });
    if (
      !isRecord(initialized) ||
      typeof initialized.codexHome !== "string" ||
      !isAbsolute(initialized.codexHome) ||
      initialized.codexHome.includes("\0")
    ) {
      throw new Error("Codex discovery did not report a valid absolute Codex home.");
    }
    const version =
      typeof initialized.userAgent === "string"
        ? initialized.userAgent.match(
            /^cdx_chores\/([0-9]+\.[0-9]+\.[0-9]+(?:[-+][\w.-]+)?)(?:\s|$)/,
          )?.[1]
        : undefined;
    if (!version) throw new Error("Codex discovery did not report a valid CLI version.");
    transport.initialized();
    const configuration = await transport.request("config/read", {
      cwd: options.cwd,
      includeLayers: false,
    });
    if (!isRecord(configuration) || !isRecord(configuration.config)) {
      throw new Error("Codex discovery returned invalid configuration metadata.");
    }
    let models: unknown[] | null = null;
    if (options.view !== "providers") {
      models = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; ; page++) {
        if (page >= MAX_MODEL_PAGES)
          throw new Error("Codex discovery exceeded its model page limit.");
        const response = await transport.request("model/list", {
          includeHidden: false,
          ...(cursor === undefined ? {} : { cursor }),
        });
        if (
          !isRecord(response) ||
          !Array.isArray(response.data) ||
          !(response.nextCursor === null || typeof response.nextCursor === "string")
        ) {
          throw new Error("Codex discovery returned invalid model metadata.");
        }
        if (models.length + response.data.length > MAX_MODELS) {
          throw new Error("Codex discovery exceeded its model count limit.");
        }
        models.push(...response.data);
        if (response.nextCursor === null) break;
        if (!response.nextCursor || cursors.has(response.nextCursor)) {
          throw new Error("Codex discovery returned a repeated or invalid model cursor.");
        }
        cursors.add(response.nextCursor);
        cursor = response.nextCursor;
      }
    }
    transport.assertHealthy();
    return {
      context: {
        cwd: options.cwd,
        codexVersion: version,
        codexHome: initialized.codexHome,
        codexHomeSource:
          env.CODEX_HOME === undefined || env.CODEX_HOME === "" ? "default" : "environment",
      },
      config: configuration.config,
      models,
    };
  } finally {
    await transport.close();
  }
}
