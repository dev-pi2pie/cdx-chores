// On-demand only: bun build ... --target=node, then invoke the bundle with Node.
import { createLab } from "./video-frames/lab";
import { timingEvidence } from "./video-frames/timing-evidence";
import { streamEvidence, pixelGuardEvidence } from "./video-frames/stream-evidence";

async function main(): Promise<void> {
  const group = process.argv[2] ?? "timing";
  if (!["timing", "streams", "guard"].includes(group))
    throw new Error("Choose an explicit smoke group: timing, streams, guard.");
  const lab = await createLab();
  try {
    if (group === "timing") await lab.check("timing", 0, 8 * 1024 * 1024, timingEvidence);
    if (group === "streams") await lab.check("streams", 1, 8 * 1024 * 1024, streamEvidence);
    if (group === "guard") await lab.check("guard", 0, 16 * 1024 * 1024, pixelGuardEvidence);
  } finally {
    lab.finish();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
