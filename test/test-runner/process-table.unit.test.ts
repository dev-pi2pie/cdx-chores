import { describe, expect, test } from "bun:test";

import { isLiveProcess, parseProcessTable } from "../../scripts/testing/process-table.ts";

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
