import { expect, test } from "bun:test";

import { probeNativePrerequisites } from "../helpers/native-prerequisites";

const probe = (script: string) =>
  probeNativePrerequisites({
    executable: "node",
    args: ["--eval", script],
    env: { PATH: process.env.PATH },
    timeoutMs: 300,
    graceMs: 100,
    cleanupMs: 750,
  });

test("native child readiness is read only after verified successful completion", async () => {
  const readiness = { duckdb: true, excel: false, sqlite: true };
  expect(await probe(`process.stdout.write(${JSON.stringify(JSON.stringify(readiness))})`)).toEqual(
    readiness,
  );
  await expect(
    probe(`process.stdout.write(${JSON.stringify(JSON.stringify(readiness))}); process.exitCode=1`),
  ).rejects.toThrow('"reason":"exit-failed"');
});

test("native child malformed readiness fails without exposing its output", async () => {
  await expect(probe('process.stdout.write("private-host-detail")')).rejects.toThrow(
    "Native prerequisite probe returned an invalid readiness report.",
  );
  await expect(probe('process.stdout.write("{}")')).rejects.toThrow(
    "Native prerequisite probe returned an invalid readiness report.",
  );
});

test("blocked native initialization is terminated within the ownership deadline", async () => {
  const started = performance.now();
  await expect(probe("while (true) {}")).rejects.toThrow('"reason":"timeout"');
  expect(performance.now() - started).toBeLessThan(2000);
});
