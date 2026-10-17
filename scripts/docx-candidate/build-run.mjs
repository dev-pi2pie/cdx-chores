import assert from "node:assert/strict";
import { copyFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { build } from "tsdown";

import { buildCandidateAssets, buildProductAssets, candidateBuildOptions } from "./build.mjs";

// Build work runs in an owned process so cancellation/deadlines can stop bundling.
const [mode, destination] = process.argv.slice(2);
assert(destination && isAbsolute(destination));
assert(["comparison", "measurement", "package-input", "product"].includes(mode));
if (mode === "product") {
  await buildProductAssets(destination);
} else if (mode === "package-input") {
  await build({
    ...candidateBuildOptions(destination),
    entry: { input: "test/document-rename/fixtures/docx-package-input.ts" },
    format: ["esm"],
  });
} else if (mode === "comparison") {
  await buildCandidateAssets(destination);
  await build({
    ...candidateBuildOptions(destination),
    entry: { compare: "scripts/docx-candidate/run.ts" },
    format: ["esm"],
  });
} else if (mode === "measurement") {
  await buildCandidateAssets(destination);
  const entry = {
    "measure-run": "scripts/docx-candidate/measure-run.ts",
    "measure-child": "scripts/docx-candidate/measure-child.ts",
    "measure-success-worker": "test/document-rename/fixtures/docx-runtime/success-worker.ts",
  };
  for (const transition of ["postparse", "postencode"])
    for (const position of ["below", "at", "above"])
      entry[`measure-${transition}-${position}`] = "scripts/docx-candidate/measure-transition.ts";
  await build({ ...candidateBuildOptions(destination), entry, format: ["esm"] });
  await copyFile(
    new URL("../../test/document-rename/fixtures/docx-baseline/measurement.json", import.meta.url),
    join(destination, "measurement-expected.json"),
  );
}
