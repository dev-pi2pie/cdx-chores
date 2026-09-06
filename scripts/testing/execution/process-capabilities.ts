import { requireProcessObservation, type ProcessMember } from "./process-table.ts";

/** Signal zero checks access; it never terminates or otherwise signals work. */
export function assertProcessGroupAccess(
  members: readonly ProcessMember[],
  pid: number,
  probe: (group: number, signal: 0) => unknown,
): void {
  const self = members.find((member) => member.pid === pid);
  if (!self || self.groupId <= 1) {
    throw new Error("Required process-group identity is unavailable.");
  }
  try {
    probe(-self.groupId, 0);
  } catch {
    throw new Error("Required POSIX process-group access is unavailable.");
  }
}

let verified = false;

/** Bounded read-only bootstrap, before starting work that needs group ownership. */
export function requireProcessCapabilities(): void {
  if (verified) return;
  const members = requireProcessObservation();
  assertProcessGroupAccess(members, process.pid, (group, signal) => process.kill(group, signal));
  verified = true;
}
