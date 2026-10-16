import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let controls = 0;
// These deliberate calls happen during parser import, independently of the guard's controls.
for (const call of [
  () => readFileSync("/docx-baseline-synthetic-never-load.png"),
  () => spawnSync("docx-positive-control"),
]) {
  try {
    call();
  } catch (error) {
    if (error instanceof Error && error.message === "docx_offline_guard_intercepted") controls += 1;
  }
}

export async function readDocxDocument() {
  if (controls !== 2) throw new Error("Synthetic import controls were not intercepted");
  return {
    ok: true,
    facts: {
      rawText: "Independent fixture report\n\n",
      headings: [],
      hasContent: true,
      metadataResult: { warnings: [] },
      diagnostics: [],
    },
  };
}
