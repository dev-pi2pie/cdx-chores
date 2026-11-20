import { expect, test } from "bun:test";

import { extractAppServerVersion } from "../../../src/adapters/codex/app-server-version";

test.each([
  [undefined, "cdx_chores/0.171.0 (fixture)", "0.171.0"],
  ["unrelated", "codex_exec/0.171.0", "0.171.0"],
  ["Codex Exec", "Codex Exec/0.171.0 (fixture)", "0.171.0"],
  ["codex/exec", "codex/exec/0.171.0-beta.1+build.2", "0.171.0-beta.1+build.2"],
  ["Codex [Exec]+", "Codex [Exec]+/0.171.0", "0.171.0"],
  [undefined, "Codex Exec/0.171.0", undefined],
  [undefined, "codex/exec/0.171.0", undefined],
  ["Codex Exec", "Codex exec/0.171.0", undefined],
  ["codex/exec", "prefix codex/exec/0.171.0", undefined],
  ["codex/exec", "codex/exec/nope cdx_chores/0.171.0", undefined],
  ["Codex Exec", "Codex Exec/ 0.171.0", undefined],
  ["codex/exec", "codex/exec/0.171.0/extra", undefined],
  ["codex/exec", "codex/exec/0.171.0+", undefined],
  [undefined, "/0.171.0", undefined],
  [undefined, 171, undefined],
] as const)(
  "extracts a leading version with override %j and agent %j",
  (originator, agent, version) => {
    const env = { CODEX_INTERNAL_ORIGINATOR_OVERRIDE: originator };
    expect(extractAppServerVersion(agent, env)?.version).toBe(version);
  },
);
