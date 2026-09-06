import { afterAll, expect, mock } from "bun:test";
import * as childProcess from "node:child_process";

// Verification-only preload. A caught prerequisite error must still fail the run.
const violations: string[] = [];
function forbidden(operation: string): never {
  violations.push(operation);
  throw new Error(`Unit selection attempted an integration dependency: ${operation}`);
}

mock.module("node:child_process", () => ({
  ...childProcess,
  spawn: () => forbidden("child_process.spawn"),
  spawnSync: () => forbidden("child_process.spawnSync"),
  exec: () => forbidden("child_process.exec"),
  execSync: () => forbidden("child_process.execSync"),
  execFile: () => forbidden("child_process.execFile"),
  execFileSync: () => forbidden("child_process.execFileSync"),
  fork: () => forbidden("child_process.fork"),
}));
Object.assign(Bun, {
  spawn: () => forbidden("Bun.spawn"),
  spawnSync: () => forbidden("Bun.spawnSync"),
});
globalThis.fetch = Object.assign(() => forbidden("fetch"), {
  preconnect: () => forbidden("fetch.preconnect"),
});
Bun.plugin({
  name: "unit-prerequisite-boundary",
  setup(builder) {
    builder.onResolve({ filter: /^@duckdb\// }, ({ path }) => forbidden(path));
    builder.onResolve({ filter: /\.node$/ }, ({ path }) =>
      forbidden(`native module ${path.split("/").at(-1)}`),
    );
  },
});

afterAll(() => {
  expect(violations, "Unit selection must not probe integration prerequisites.").toEqual([]);
});
