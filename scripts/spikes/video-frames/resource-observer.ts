// Explicit synthetic verification only. Sampling is observational, not a memory guarantee.
import { spawn, execFileSync } from "node:child_process";
import type { ExportOptions } from "../../../src/cli/video-frames/export";
export function observeExportResources() {
  const active = new Map<number, { kind: string; peakKiB: number | null }>();
  const children: { kind: string; peakKiB: number | null }[] = [];
  let parentPeakBytes = process.memoryUsage().rss,
    childrenPeakKiB = 0,
    peakChildren = 0;
  const sample = () => {
    parentPeakBytes = Math.max(parentPeakBytes, process.memoryUsage().rss);
    if (!active.size) return;
    try {
      const output = execFileSync(
        "/bin/ps",
        ["-o", "pid=,rss=", "-p", [...active.keys()].join(",")],
        { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] },
      );
      let sum = 0;
      for (const line of output.trim().split("\n")) {
        const [pid, rss] = line.trim().split(/\s+/).map(Number);
        const child = active.get(pid!);
        if (child && rss! > 0) {
          child.peakKiB = Math.max(child.peakKiB ?? 0, rss!);
          sum += rss!;
        }
      }
      childrenPeakKiB = Math.max(childrenPeakKiB, sum);
    } catch {
      /* A child may close before the sample. Null remains unmeasured. */
    }
  };
  const timer = setInterval(sample, 50);
  const launch: NonNullable<ExportOptions["launch"]> = (command, args, options) => {
    const child = spawn(command, args, options);
    const kind = args.includes("image2pipe")
      ? "encoder"
      : args.includes("rawvideo")
        ? "decoder"
        : args.includes("-show_frames")
          ? "scan"
          : args.includes("json")
            ? "inspection"
            : "capability";
    const observation = { kind, peakKiB: null as number | null };
    children.push(observation);
    if (child.pid) {
      active.set(child.pid, observation);
      peakChildren = Math.max(peakChildren, active.size);
      child.once("close", () => active.delete(child.pid!));
    }
    return child;
  };
  return {
    launch,
    finish() {
      sample();
      clearInterval(timer);
      return {
        parentPeakBytes,
        childrenPeakKiB,
        peakChildren,
        children,
        counts: Object.fromEntries(
          ["encoder", "decoder", "scan", "inspection", "capability"].map((kind) => [
            kind,
            children.filter((child) => child.kind === kind).length,
          ]),
        ),
      };
    },
  };
}
