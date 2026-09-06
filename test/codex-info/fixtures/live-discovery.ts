import { discoverCodexInfo } from "../../../src/adapters/codex/discovery/index.ts";

const view = process.argv[2];
if (view !== "summary" && view !== "models" && view !== "providers") {
  throw new Error("Expected a Codex information view.");
}

// The test's outer process owner bounds this real production adapter and descendants.
const discovery = await discoverCodexInfo({ cwd: process.cwd(), env: process.env, view });
process.stdout.write(JSON.stringify(discovery) + "\n");
