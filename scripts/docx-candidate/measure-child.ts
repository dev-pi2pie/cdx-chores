import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_DOCX_LIMITS } from "../../src/docx/limits";
import { runDocxChild } from "../../src/docx/runtime/child";
import type { ChildMeasurement } from "./measure-types";

// Only a cheap scalar accumulator runs inside the real policy callback.
const measurement: ChildMeasurement = {
  pid: process.pid,
  bootMs: performance.timeOrigin + performance.now(),
  firstPolicySampleMs: null,
  lastPolicySampleMs: null,
  finishedMs: 0,
  policySamples: 0,
  policyPeakRssBytes: 0,
  observedPeakRssBytes: process.memoryUsage.rss(),
};
const observe = () => {
  const rss = process.memoryUsage.rss();
  measurement.observedPeakRssBytes = Math.max(measurement.observedPeakRssBytes, rss);
  return rss;
};
// This independent measurement also covers framed-input reception before policy starts.
const interval = setInterval(observe, DEFAULT_DOCX_LIMITS.rssSampleMilliseconds);
try {
  await runDocxChild({
    sampleRss() {
      const now = performance.timeOrigin + performance.now();
      const rss = observe();
      measurement.firstPolicySampleMs ??= now;
      measurement.lastPolicySampleMs = now;
      measurement.policySamples++;
      measurement.policyPeakRssBytes = Math.max(measurement.policyPeakRssBytes, rss);
      return rss;
    },
  });
} finally {
  clearInterval(interval);
  observe();
  measurement.finishedMs = performance.timeOrigin + performance.now();
  // Fixed sibling path in an owned temporary build, never mixed into result framing.
  await writeFile(
    join(dirname(fileURLToPath(import.meta.url)), "child-measurement.json"),
    JSON.stringify(measurement),
  );
}
