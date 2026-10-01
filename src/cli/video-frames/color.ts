import { CliError } from "../errors";
import type { VideoStream } from "./types";
export function imageColor(stream: VideoStream) {
  const format = stream.pixelFormat ?? "";
  const rgb = /^(?:rgba|bgra|argb|abgr|rgb24|bgr24|rgb0|bgr0|0rgb|0bgr)$/.test(format);
  const yuv = /^(?:yuv(?:420|422|444)p|yuvj(?:420|422|444)p|yuva(?:420|422|444)p|nv12|nv21)$/.test(
    format,
  );
  if (!rgb && !yuv)
    throw unsupported("Only the verified 8-bit RGB/YUV conversion path is supported.");
  const alpha = /^(?:rgba|bgra|argb|abgr|yuva)/.test(format);
  if (stream.sourceAlpha && !alpha)
    throw new CliError(
      "Source declares alpha that the default decoder does not expose; this source alpha path is unsupported.",
      { code: "FRAME_ALPHA_UNSUPPORTED" },
    );
  const notices: string[] = [];
  function field(name: string, value: string | undefined, fallback: string) {
    if (value === undefined || value === "unknown" || value === "unspecified") {
      notices.push(`Color ${name} unavailable; assuming ${fallback}.`);
      return fallback;
    }
    return value;
  }
  const image = stream.image;
  const matrix = field("matrix", image?.colorSpace, rgb ? "gbr" : "smpte170m");
  const range = field("range", image?.colorRange, rgb || format.startsWith("yuvj") ? "pc" : "tv");
  const primaries = field("primaries", image?.colorPrimaries, "bt709");
  const transfer = field("transfer", image?.colorTransfer, rgb ? "iec61966-2-1" : "bt709");
  if (primaries !== "bt709" || (transfer !== "bt709" && transfer !== "iec61966-2-1"))
    throw unsupported(
      "Unsupported primaries/transfer; HDR and wide-gamut conversion are unavailable.",
    );
  if (
    (range !== "tv" && range !== "pc") ||
    (rgb && (matrix !== "gbr" || range !== "pc" || transfer !== "iec61966-2-1")) ||
    (yuv && !["bt709", "smpte170m", "bt470bg"].includes(matrix))
  )
    throw unsupported("Conflicting or unsupported color matrix/range.");
  let filters: string[];
  if (rgb) filters = ["format=rgb24"];
  else if (transfer === "bt709") {
    if (stream.width % 2 || stream.height % 2)
      throw unsupported("The verified transfer-conversion path requires even decoded dimensions.");
    filters = [
      `colorspace=ispace=${matrix}:irange=${range}:iprimaries=bt709:itrc=bt709:space=bt709:primaries=bt709:trc=iec61966-2-1:range=pc:format=yuv444p`,
      "scale=in_color_matrix=bt709:in_range=pc:out_range=pc",
      "format=rgb24",
    ];
  } else
    filters = [
      `scale=in_color_matrix=${matrix === "bt709" ? "bt709" : "bt601"}:in_range=${range}:out_range=pc`,
      "format=rgb24",
    ];
  return { filters, notices, alpha };
}
function unsupported(message: string) {
  return new CliError(message, { code: "FRAME_COLOR_UNSUPPORTED" });
}
