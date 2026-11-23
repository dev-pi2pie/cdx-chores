import type { ImageFormat } from "./image-options";
import { JpegFrames } from "./image-framing/jpeg";
import { PngFrames } from "./image-framing/png";
import type { Framer, ImageSink } from "./image-framing/shared";
import { WebpFrames } from "./image-framing/webp";
import { validateImageProfile, type ImageProfile } from "./profile-chunks";

export type { ImageSink } from "./image-framing/shared";
export type { ImageProfile } from "./profile-chunks";

export function imageFramer(format: ImageFormat, sink: ImageSink, profile?: ImageProfile): Framer {
  if (profile) validateImageProfile(profile);
  return format === "png"
    ? new PngFrames(sink, profile)
    : format === "jpg"
      ? new JpegFrames(sink, profile)
      : new WebpFrames(sink, profile);
}
