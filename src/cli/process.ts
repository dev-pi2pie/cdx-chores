import { spawn } from "node:child_process";

export interface ExecCommandResult {
  ok: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export async function execCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<ExecCommandResult> {
  return await new Promise<ExecCommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code, signal) => {
      resolve({
        ok: code === 0,
        code,
        signal,
        stdout,
        stderr,
      });
    });
  });
}

