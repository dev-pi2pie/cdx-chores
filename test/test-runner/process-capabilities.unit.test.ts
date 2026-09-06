import { describe, expect, test } from "bun:test";
import { assertProcessGroupAccess } from "../../scripts/testing/execution/process-capabilities.ts";

const member = { pid: 123, parentPid: 1, groupId: 120, state: "S", executable: "bun" };
describe("process-group capability", () => {
  test("checks access using signal zero on the observed group", () => {
    const calls: unknown[] = [];
    assertProcessGroupAccess([member], 123, (...args) => calls.push(args));
    expect(calls).toEqual([[-120, 0]]);
  });
  test("rejects unavailable group operations without exposing native errors", () => {
    expect(() =>
      assertProcessGroupAccess([member], 123, () => {
        throw new Error("private");
      }),
    ).toThrow("Required POSIX process-group access is unavailable.");
  });
  test.each([[[]], [[{ ...member, groupId: 1 }]]])(
    "rejects missing or invalid ownership before probing",
    (members) => {
      let called = false;
      expect(() =>
        assertProcessGroupAccess(members, 123, () => {
          called = true;
        }),
      ).toThrow();
      expect(called).toBe(false);
    },
  );
});
