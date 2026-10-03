// On-demand only: bun build ... --target=node, then invoke the bundle with Node.
import { createLab } from "./video-frames/lab";
import { timingEvidence } from "./video-frames/timing-evidence";
import { streamEvidence, pixelGuardEvidence } from "./video-frames/stream-evidence";
import { imageEvidence, colorAndTransformEvidence } from "./video-frames/image-evidence";
import { displayEvidence } from "./video-frames/display-evidence";
import { encoderEvidence } from "./video-frames/encoder-evidence";
import { writerEvidence } from "./video-frames/writer-evidence";
import { workloadEvidence } from "./video-frames/workload-evidence";

async function main(): Promise<void> {
  const group = process.argv[2] ?? "timing";
  if (
    ![
      "timing",
      "streams",
      "guard",
      "png-jpg",
      "images",
      "transforms",
      "display",
      "encoders",
      "writer",
      "workloads",
    ].includes(group)
  )
    throw new Error(
      "Choose an explicit smoke group: timing, streams, guard, png-jpg, images, transforms, display, encoders, writer, workloads.",
    );
  const lab = await createLab();
  try {
    if (group === "timing") await lab.check("timing", 0, 8 * 1024 * 1024, timingEvidence);
    if (group === "streams") await lab.check("streams", 1, 8 * 1024 * 1024, streamEvidence);
    if (group === "guard") await lab.check("guard", 0, 16 * 1024 * 1024, pixelGuardEvidence);
    if (group === "png-jpg" || group === "images")
      await lab.check("images", 13, 8 * 1024 * 1024, (e) => imageEvidence(e, group === "images"));
    if (group === "transforms")
      await lab.check("transforms", 7, 8 * 1024 * 1024, colorAndTransformEvidence);
    if (group === "display") await lab.check("display", 7, 8 * 1024 * 1024, displayEvidence);
    if (group === "encoders") await lab.check("encoders", 0, 1024 * 1024, encoderEvidence);
    if (group === "writer") await lab.check("writer", 6, 8 * 1024 * 1024, writerEvidence);
    if (group === "workloads")
      for (const seconds of [30, 120, 300])
        await lab.check(`workload-${seconds}`, seconds, 64 * 1024 * 1024, (e) =>
          workloadEvidence(e, seconds),
        );
  } finally {
    lab.finish();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
