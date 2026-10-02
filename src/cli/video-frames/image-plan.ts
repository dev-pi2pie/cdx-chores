import { displayGeometry } from "./display";
import { imageColor } from "./color";
import { imageColorTags, type ImageOptions } from "./image-options";
import { sourceRgbProfile } from "./color-profile";
import type { VideoStream } from "./types";
export function imagePlan(stream: VideoStream, options: ImageOptions, select?: string) {
  const geometry = displayGeometry(stream, options.scale);
  const color = imageColor(stream);
  const source = `[0:${stream.index}]`;
  const pre = select ? `${select},` : "";
  const shape = geometry.filters.join(",");
  const tags = imageColorTags(color.transfer);
  const filters = color.alpha
    ? `${source}${pre}split[c][a];[c]${color.filters.join(",")},${shape}[c1];[a]alphaextract,${shape}[a1];[c1][a1]alphamerge,format=rgba,${tags}[out]`
    : `${source}${pre}${color.filters.join(",")},${shape},format=rgba,${tags}[out]`;
  return Object.freeze({
    width: geometry.width,
    height: geometry.height,
    frameBytes: geometry.width * geometry.height * 4,
    filters,
    transfer: color.transfer,
    profile: Object.freeze({
      icc: sourceRgbProfile(color.transfer),
      width: geometry.width,
      height: geometry.height,
    }),
    notices: Object.freeze([...geometry.notices, ...color.notices]),
  });
}
