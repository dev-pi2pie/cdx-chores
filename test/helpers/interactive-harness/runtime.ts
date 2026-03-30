export class CaptureStream {
  public text = "";
  public columns?: number;
  public isTTY?: boolean;

  public write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

export function createHarnessRuntime(options: { stdoutColumns?: number; stdoutIsTTY?: boolean } = {}) {
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  stdout.columns = options.stdoutColumns;
  stdout.isTTY = options.stdoutIsTTY;
  const runtime = {
    cwd: process.cwd(),
    colorEnabled: true,
    now: () => new Date("2026-02-25T00:00:00.000Z"),
    platform: process.platform,
    stdout,
    stderr,
    stdin: process.stdin,
    displayPathStyle: "relative" as const,
  };

  return { runtime, stdout, stderr };
}
