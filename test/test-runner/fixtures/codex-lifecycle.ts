import { join } from "node:path";

import { DiscoveryTransport, isRecord } from "../../../src/adapters/codex/discovery/transport.ts";
import { LiveProtocolClient } from "../../codex-info/live-protocol-client.ts";

const [mode, executable, root] = process.argv.slice(2);
if (!executable || !root || (mode !== "protocol" && mode !== "transport")) {
  throw new Error("Expected a lifecycle probe mode, executable, and isolated root.");
}
const cwd = join(root, "project");
const client =
  mode === "protocol"
    ? new LiveProtocolClient(executable, cwd, process.env)
    : new DiscoveryTransport(executable, cwd, process.env, 10_000);

try {
  const initialized = await client.request("initialize", {
    clientInfo: { name: "cdx_chores_lifecycle_check", version: "1" },
    capabilities: { experimentalApi: false },
  });
  if (!isRecord(initialized) || typeof initialized.codexHome !== "string") {
    throw new Error("Invalid initialization response.");
  }
  if (client instanceof LiveProtocolClient) client.notify("initialized");
  else client.initialized();
  const config = await client.request("config/read", { cwd, includeLayers: false });
  const models = await client.request("model/list", { includeHidden: false, limit: 2 });
  if (
    !isRecord(config) ||
    !isRecord(config.config) ||
    !isRecord(models) ||
    !Array.isArray(models.data)
  ) {
    throw new Error("Invalid metadata response shape.");
  }
  // Record checks, never raw responses or temporary home/configuration values.
  process.stdout.write(JSON.stringify({ mode, checkedRequests: 3 }) + "\n");
} finally {
  await client.close();
}
