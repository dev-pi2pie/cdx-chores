import { basename } from "node:path";

import type {
  MarkdownPdfTemplateCodexCoverImageDimensions,
  MarkdownPdfTemplateCodexCoverImageSignals,
  MarkdownPdfTemplateCodexFitPressure,
  MarkdownPdfTemplateCodexOrientationBucket,
} from "./types";
import { imageFormatForPath, readTemplateCodexCoverImageMetadata } from "./image-metadata";

function orientationBucket(
  dimensions: MarkdownPdfTemplateCodexCoverImageDimensions | undefined,
): MarkdownPdfTemplateCodexOrientationBucket {
  if (!dimensions) {
    return "unknown";
  }
  const ratio = dimensions.width / dimensions.height;
  if (ratio >= 2) {
    return "panoramic";
  }
  if (ratio <= 0.5) {
    return "tall";
  }
  if (ratio > 1.1) {
    return "landscape";
  }
  if (ratio < 0.9) {
    return "portrait";
  }
  return "square";
}

function fitPressure(
  bucket: MarkdownPdfTemplateCodexOrientationBucket,
): MarkdownPdfTemplateCodexFitPressure {
  if (bucket === "unknown") {
    return "unknown";
  }
  if (bucket === "panoramic") {
    return "letterbox-risk";
  }
  if (bucket === "tall") {
    return "crop-risk";
  }
  return "normal";
}

export async function collectTemplateCodexCoverImageSignals(
  path: string | undefined,
): Promise<MarkdownPdfTemplateCodexCoverImageSignals> {
  if (!path) {
    return {
      available: false,
      orientationBucket: "unknown",
      fitPressure: "unknown",
    };
  }

  const format = imageFormatForPath(path);
  const metadata = await readTemplateCodexCoverImageMetadata(path, format);
  const dimensions = metadata.status === "parsed" ? metadata.dimensions : undefined;
  const bucket = orientationBucket(dimensions);
  return {
    available: true,
    sourceBasename: basename(path),
    format,
    metadataStatus: metadata.status,
    ...(dimensions
      ? {
          dimensions,
          aspectRatio: Number((dimensions.width / dimensions.height).toFixed(4)),
        }
      : {}),
    orientationBucket: bucket,
    fitPressure: fitPressure(bucket),
  };
}
