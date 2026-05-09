import type { CliRuntime } from "../../../types";
import { printLine } from "../../shared";

export function startAnalyzerProgress(
  runtime: CliRuntime,
  label: string,
): { stop: (status: "done" | "fallback") => void } {
  const stream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };

  if (!stream.isTTY) {
    printLine(runtime.stdout, `${label}...`);
    return { stop: () => {} };
  }

  const frames = ["-", "\\", "|", "/"];
  let frameIndex = 0;
  const render = () => {
    const frame = frames[frameIndex % frames.length] ?? "-";
    frameIndex += 1;
    stream.write(`\r${label}... ${frame}`);
  };

  render();
  const timer = setInterval(render, 120);

  return {
    stop: (status) => {
      clearInterval(timer);
      stream.write(`\r${label}... ${status === "done" ? "done" : "fallback"}\n`);
    },
  };
}
