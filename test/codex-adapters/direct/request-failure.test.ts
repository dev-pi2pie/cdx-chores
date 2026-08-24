import { describe, expect, test } from "bun:test";

import {
  classifyCodexRequestFailure,
  formatCodexTimeoutFailure,
} from "../../../src/utils/codex-request-failure";

function withCause(name: string, cause?: unknown): Error & { cause?: unknown } {
  const error = new Error(name) as Error & { cause?: unknown };
  error.name = name;
  error.cause = cause;
  return error;
}

describe("Codex request failure classification and timeout formatting", () => {
  test("recognizes a direct TimeoutError", () => {
    expect(classifyCodexRequestFailure(withCause("TimeoutError"))).toBe("timeout");
  });

  test("recognizes a TimeoutError through a preserved cause chain", () => {
    const timeout = withCause("TimeoutError");
    const wrapped = withCause("SdkRequestError", withCause("TransportError", timeout));

    expect(classifyCodexRequestFailure(wrapped)).toBe("timeout");
  });

  test("prefers a preserved timeout cause over an outer AbortError", () => {
    const wrapped = withCause("AbortError", withCause("TimeoutError"));

    expect(classifyCodexRequestFailure(wrapped)).toBe("timeout");
  });

  test("keeps an ordinary AbortError distinct from a timeout", () => {
    expect(classifyCodexRequestFailure(withCause("AbortError"))).toBe("aborted");
  });

  test("does not infer timeout from arbitrary error messages", () => {
    expect(classifyCodexRequestFailure(new Error("request timed out after 30 seconds"))).toBe(
      "other",
    );
  });

  test("bounds cause traversal and terminates safely on cycles", () => {
    let overDepth: unknown = withCause("TimeoutError");
    for (let index = 0; index < 8; index += 1) {
      overDepth = withCause("WrappedError", overDepth);
    }

    const cyclic = withCause("WrappedError");
    cyclic.cause = cyclic;

    expect(classifyCodexRequestFailure(overDepth)).toBe("other");
    expect(classifyCodexRequestFailure(cyclic)).toBe("other");
  });

  test("formats stable per-attempt duration and exhaustion context", () => {
    expect(
      formatCodexTimeoutFailure({
        requestLabel: "Codex image-title request",
        timeoutMs: 30_000,
        attemptsUsed: 1,
      }),
    ).toBe("Codex image-title request timed out after the 30s per-attempt limit.");

    expect(
      formatCodexTimeoutFailure({
        requestLabel: "Codex document-title request",
        timeoutMs: 120_000,
        attemptsUsed: 3,
      }),
    ).toBe(
      "Codex document-title request timed out after the 2m per-attempt limit; 3 attempts were exhausted.",
    );
  });
});
