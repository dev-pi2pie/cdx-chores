import assert from "node:assert/strict";

import { extractBaselineDocxEvidence } from "../../test/document-rename/fixtures/docx-baseline/extractor";

const path = process.argv[2];
assert(path);
const started = performance.now();
const result = await extractBaselineDocxEvidence(path);
process.stdout.write(
  JSON.stringify({
    extractionMilliseconds: performance.now() - started,
    // Node documents maxRSS in KiB on every supported platform.
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    outcome: "reason" in result ? result.reason : "evidence",
    result,
  }),
);
