export interface FrameTime {
  numerator: bigint;
  denominator: bigint;
}
export type FrameRequest =
  | { kind: "first" }
  | { kind: "last" }
  | { kind: "frame"; frameNumber: number }
  | { kind: "time"; timeMs: FrameTime };
export interface ResolvedFrame {
  frameNumber: number;
  streamIndex: number;
  startTicks?: bigint;
  startMs?: FrameTime;
}
export interface VideoStream {
  index: number;
  codec: string;
  width: number;
  height: number;
  pixelFormat?: string;
  timeBase: FrameTime;
  startTicks?: bigint;
  durationTicks?: bigint;
  estimatedFrameCount?: number;
  estimatedDurationMs?: FrameTime;
  fingerprint: string;
  eligibleStreams: number;
}
export interface FrameRecord {
  streamIndex: number;
  startTicks?: bigint;
  durationTicks?: bigint;
}
export type FrameSetPreset = "first-last" | "first-middle-last";
export interface FrameSetRole {
  selection: "first" | "middle" | "last";
  identity: ResolvedFrame;
  targetMs?: FrameTime;
}
