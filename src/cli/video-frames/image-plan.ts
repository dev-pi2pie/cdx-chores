import { displayGeometry } from "./display";
import { imageColor } from "./color";
import { RGB_TAGS, type ImageOptions } from "./image-options";
import type { VideoStream } from "./types";
export function imagePlan(stream: VideoStream, options: ImageOptions, select?: string) {
  const geometry = displayGeometry(stream, options.scale);
  const color = imageColor(stream);
  const source = `[0:${stream.index}]`;
  const pre = select ? `${select},` : "";
  const shape = geometry.filters.join(",");
  const filters = color.alpha
    ? `${source}${pre}split[c][a];[c]${color.filters.join(",")},${shape}[c1];[a]alphaextract,${shape}[a1];[c1][a1]alphamerge,format=rgba,${RGB_TAGS}[out]`
    : `${source}${pre}${color.filters.join(",")},${shape},format=rgba,${RGB_TAGS}[out]`;
  return Object.freeze({
    width: geometry.width,
    height: geometry.height,
    frameBytes: geometry.width * geometry.height * 4,
    filters,
    notices: Object.freeze([...geometry.notices, ...color.notices]),
  });
}
