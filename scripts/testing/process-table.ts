import { execFile } from "node:child_process";
import { basename } from "node:path";

export interface ProcessMember {
  pid: number;
  parentPid: number;
  groupId: number;
  state: string;
  executable: string;
}

/** ps comm contains the executable only; never request command arguments or env. */
export function parseProcessTable(output: string): ProcessMember[] {
  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
      if (!match) throw new Error("Unable to parse process-state observation.");
      return {
        pid: Number(match[1]),
        parentPid: Number(match[2]),
        groupId: Number(match[3]),
        state: match[4]!,
        executable: basename(match[5]!.trim()),
      };
    });
}

export function isLiveProcess(member: ProcessMember): boolean {
  return !member.state.startsWith("Z");
}

export async function observeProcessGroup(
  groupId: number,
  timeoutMs: number,
): Promise<ProcessMember[]> {
  if (!Number.isSafeInteger(groupId) || groupId <= 1) {
    throw new Error("Invalid owned process group.");
  }
  return await new Promise((resolve, reject) => {
    execFile(
      "/bin/ps",
      ["-ax", "-o", "pid=,ppid=,pgid=,stat=,comm="],
      {
        timeout: Math.max(1, Math.floor(timeoutMs)),
        killSignal: "SIGKILL",
        maxBuffer: 4 * 1024 * 1024,
        env: { LC_ALL: "C" },
      },
      (error, stdout) => {
        if (error) {
          reject(new Error("Process-state observation failed or timed out."));
          return;
        }
        try {
          resolve(parseProcessTable(stdout).filter((member) => member.groupId === groupId));
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}
