import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { build } from "tsdown";

import { buildCandidateAssets, candidateBuildOptions } from "./build.mjs";

// Build work runs in an owned process so cancellation/deadlines can stop bundling.
const [mode, destination, prepared] = process.argv.slice(2);
assert(destination && isAbsolute(destination));
assert(["comparison", "measurement", "package"].includes(mode));
await buildCandidateAssets(destination);
if (mode === "comparison") {
  await build({
    ...candidateBuildOptions(destination),
    entry: { compare: "scripts/docx-candidate/run.ts" },
    format: ["esm"],
  });
} else if (mode === "measurement") {
  const entry = {
    "measure-run": "scripts/docx-candidate/measure-run.ts",
    "measure-child": "scripts/docx-candidate/measure-child.ts",
    "measure-baseline": "scripts/docx-candidate/measure-baseline.ts",
    "measure-success-worker": "test/document-rename/fixtures/docx-runtime/success-worker.ts",
  };
  for (const transition of ["postparse", "postencode"])
    for (const position of ["below", "at", "above"])
      entry[`measure-${transition}-${position}`] = "scripts/docx-candidate/measure-transition.ts";
  await build({ ...candidateBuildOptions(destination), entry, format: ["esm"] });
} else {
  assert(prepared && isAbsolute(prepared));
  await build({
    ...candidateBuildOptions(prepared),
    entry: { input: "test/document-rename/fixtures/docx-package-input.ts" },
    format: ["esm"],
  });
}
