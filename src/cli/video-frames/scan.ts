import { CliError } from "../errors";
import { LineRecords } from "../process/records";
import { ProcessOperation } from "../process/streaming";
import { DECODER_PIXELS, FRAME_FIELDS, parseFrameRecord, requireClean } from "./metadata";
import type { FrameRecord, VideoStream } from "./types";
export interface FrameBackend {
  inspect(operation: ProcessOperation, source: string): Promise<VideoStream>;
  scan(
    operation: ProcessOperation,
    source: string,
    stream: VideoStream,
    consume: (frame: FrameRecord) => boolean | void | Promise<boolean | void>,
  ): Promise<{ cleanEof: boolean }>;
}
export async function scanVideo(
  operation: ProcessOperation,
  source: string,
  stream: VideoStream,
  consume: (frame: FrameRecord) => boolean | void | Promise<boolean | void>,
  ffprobe = "ffprobe",
): Promise<{ cleanEof: boolean }> {
  const records = new LineRecords((line) => {
    const frame = parseFrameRecord(line, stream.index);
    return frame ? consume(frame) : undefined;
  });
  const result = await operation.run(
    ffprobe,
    [
      "-v",
      "error",
      "-err_detect",
      "explode",
      "-max_pixels",
      String(DECODER_PIXELS),
      "-threads",
      "1",
      "-select_streams",
      String(stream.index),
      "-show_frames",
      "-show_entries",
      FRAME_FIELDS,
      "-of",
      "compact=p=1:nk=0",
      source,
    ],
    { consume: (chunk) => records.chunk(chunk) },
  );
  requireClean(result, "Frame scan", true);
  records.finish();
  return { cleanEof: !result.earlyStop };
}
export function nextOrdinal(current: number): number {
  if (current >= Number.MAX_SAFE_INTEGER)
    throw new CliError("Source frame ordinal exceeds the safe integer limit.", {
      code: "FRAME_NUMERIC_LIMIT",
    });
  return current + 1;
}
