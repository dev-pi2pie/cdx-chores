import { describe, expect, test } from "bun:test";

import {
  isLiveProcess,
  parseProcessTable,
  validateProcessSnapshot,
  probeProcessObservation,
} from "../../scripts/testing/execution/process-table.ts";

describe("process observation", () => {
  test("distinguishes live states from zombies and retains only executable names", () => {
    const members = parseProcessTable(
      "  101  100  101 S+ /synthetic path/node\n 102 1 101 Z codex\n",
    );
    expect(members).toEqual([
      { pid: 101, parentPid: 100, groupId: 101, state: "S+", executable: "node" },
      { pid: 102, parentPid: 1, groupId: 101, state: "Z", executable: "codex" },
    ]);
    expect(members.map(isLiveProcess)).toEqual([true, false]);
  });

  test("rejects malformed evidence rather than treating it as an empty group", () => {
    expect(() => parseProcessTable("unreadable state")).toThrow("Unable to parse");
    expect(parseProcessTable("\n")).toEqual([]);
  });
});

describe("process observation capabilities", () => {
  const snapshot = "101 100 101 Ss bun\n102 101 101 Z codex\n";
  test("accepts required fields without an operating-system name", () => {
    expect(validateProcessSnapshot(snapshot, 101)).toHaveLength(2);
  });
  test.each([
    "",
    "102 1 102 S ps",
    "101 1 101 Z bun",
    "101 1 101 S bun\n101 1 101 S bun",
    "9007199254740992 1 101 S bun",
  ])("rejects incomplete or ambiguous snapshots: %s", (value) => {
    expect(() => validateProcessSnapshot(value, 101)).toThrow();
  });
  test("tries the alternative fixed system path only when ps is absent", () => {
    const visited: string[] = [];
    const result = probeProcessObservation((path) => {
      visited.push(path);
      if (path === "/bin/ps") throw Object.assign(new Error("private path"), { code: "ENOENT" });
      return snapshot;
    }, 101);
    expect(visited).toEqual(["/bin/ps", "/usr/bin/ps"]);
    expect(result.executable).toBe("/usr/bin/ps");
  });
  test.each(["ENOENT", "EACCES", "ETIMEDOUT"])(
    "reports unavailable ps without raw diagnostics: %s",
    (code) => {
      expect(() =>
        probeProcessObservation(() => {
          throw Object.assign(new Error("private-token"), { code });
        }, 101),
      ).toThrow("Required process observation");
      try {
        probeProcessObservation(() => {
          throw new Error("private-token");
        }, 101);
      } catch (error) {
        expect(String(error)).not.toContain("private-token");
      }
    },
  );
});
