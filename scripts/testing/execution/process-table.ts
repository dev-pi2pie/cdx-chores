import { execFile, execFileSync } from "node:child_process";
import { basename } from "node:path";

export interface ProcessMember {
  pid: number;
  parentPid: number;
  groupId: number;
  state: string;
  executable: string;
}

/** Parse numeric ownership/state fields and a diagnostic executable name. */
export function parseProcessTable(output: string): ProcessMember[] {
  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
      if (!match) throw new Error("Unable to parse process-state observation.");
      const ids = match.slice(1, 4).map(Number);
      if (ids.some((id) => !Number.isSafeInteger(id) || id < 0) || ids[0] === 0)
        throw new Error("Invalid process-state identity.");
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

const PS_ARGUMENTS = ["-e", "-o", "pid=,ppid=,pgid=,stat=,ucomm="];
let executable: string | undefined;

/** A full snapshot must include its reader; empty or filtered output is not proof of exit. */
export function validateProcessSnapshot(output: string, readerPid: number): ProcessMember[] {
  const members = parseProcessTable(output);
  if (
    new Set(members.map((member) => member.pid)).size !== members.length ||
    !members.some((member) => member.pid === readerPid && isLiveProcess(member))
  ) {
    throw new Error("Required process-state fields or visibility are unavailable.");
  }
  return members;
}

/** Fixed system paths avoid executing a caller-supplied ps from an isolated test PATH. */
export function probeProcessObservation(
  read: (executable: string) => string,
  readerPid: number,
  candidates: readonly string[] = ["/bin/ps", "/usr/bin/ps"],
): { executable: string; members: ProcessMember[] } {
  for (const candidate of candidates) {
    let output: string;
    try {
      output = read(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new Error(
        "Required process observation failed: compatible ps fields and access are needed.",
      );
    }
    return { executable: candidate, members: validateProcessSnapshot(output, readerPid) };
  }
  throw new Error("Required process observation is unavailable: ps was not found in system paths.");
}

export function requireProcessObservation(): ProcessMember[] {
  const result = probeProcessObservation(
    (candidate) =>
      execFileSync(candidate, PS_ARGUMENTS, {
        timeout: 500,
        killSignal: "SIGKILL",
        maxBuffer: 4 * 1024 * 1024,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { LC_ALL: "C" },
      }),
    process.pid,
    executable ? [executable] : undefined,
  );
  executable = result.executable;
  return result.members;
}

export async function observeProcessGroup(
  groupId: number,
  timeoutMs: number,
): Promise<ProcessMember[]> {
  if (!Number.isSafeInteger(groupId) || groupId <= 1) {
    throw new Error("Invalid owned process group.");
  }
  if (!executable) requireProcessObservation();
  return await new Promise((resolve, reject) => {
    execFile(
      executable!,
      PS_ARGUMENTS,
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
          resolve(
            validateProcessSnapshot(stdout, process.pid).filter(
              (member) => member.groupId === groupId,
            ),
          );
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}
