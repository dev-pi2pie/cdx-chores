// Loaded only in the isolated caller. Allow full startup time for the fixture process.
import { mock } from "bun:test";
import { CodexAppServer } from "../../../src/adapters/codex/app-server.ts";
import * as retention from "../../../src/adapters/codex/session-retention.ts";

const request = CodexAppServer.prototype.request;
CodexAppServer.prototype.request = function (method, params, options) {
  if (method === "turn/start") options = { ...options, timeoutMs: 200 };
  return request.call(this, method, params, options);
};

const timeout = AbortSignal.timeout.bind(AbortSignal);
AbortSignal.timeout = (ms) => timeout(ms === 120_000 || ms === 2_000 ? 200 : ms);

if (process.env.FIXTURE_LATE_TURN === "1") {
  const apply = retention.applyCodexSessionRetention;
  mock.module("../../../src/adapters/codex/session-retention.ts", () => ({
    async applyCodexSessionRetention(options) {
      const result = await apply(options);
      if (result.status === "skipped") {
        // The caller has recorded unconfirmed completion. Deliver the ID and wait
        // for the following RPC reply while the transport can still process both.
        await options.request("fixture/announce-late-turn", { threadId: options.threadId });
        process.stderr.write("fixture received reply after late announcement\n");
      }
      return result;
    },
  }));
}
