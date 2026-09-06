import { expect, test } from "bun:test";

import { createNativePrerequisiteCheck } from "../helpers/native-prerequisites";

test("native preparation is lazy and shares one probe between concurrent requirements", async () => {
  let probes = 0;
  const requireNative = createNativePrerequisiteCheck(async () => {
    probes++;
    return { duckdb: true, excel: true, sqlite: false };
  });
  expect(probes).toBe(0);
  await Promise.all([requireNative("duckdb"), requireNative("excel")]);
  expect(probes).toBe(1);
  await expect(requireNative("sqlite")).rejects.toThrow(
    "Required native prerequisite unavailable: sqlite.",
  );
  expect(probes).toBe(1);
});

test("missing runtime fails explicitly even when an extension report says available", async () => {
  const requireNative = createNativePrerequisiteCheck(async () => ({
    duckdb: false,
    excel: true,
    sqlite: true,
  }));
  await expect(requireNative("excel")).rejects.toThrow(
    "Required native prerequisite unavailable: duckdb.",
  );
});

test("failed native preparation is retained without silently retrying", async () => {
  let probes = 0;
  const requireNative = createNativePrerequisiteCheck(async () => {
    probes++;
    throw new Error("synthetic probe failure");
  });
  await expect(requireNative("duckdb")).rejects.toThrow("synthetic probe failure");
  await expect(requireNative("excel")).rejects.toThrow("synthetic probe failure");
  expect(probes).toBe(1);
});
