import { describe, expect, test } from "bun:test";

import { join } from "node:path";

import {
  cleanupOwnedMarkdownPdfSession,
  createOwnedMarkdownPdfSession,
  type OwnedMarkdownPdfSession,
} from "../../../src/cli/interactive/markdown/lifecycle";

describe("interactive Markdown PDF owned lifecycle", () => {
  test("stores and removes the canonical factory result for an aliased temporary root", async () => {
    const rawPath = join("temporary-root-alias", "owned-session");
    const canonicalPath = join("canonical-temporary-root", "owned-session");
    const canonicalizeCalls: string[] = [];
    const removeCalls: Array<{ path: string; options: unknown }> = [];
    const session = await createOwnedMarkdownPdfSession({
      createDirectory: async () => rawPath,
      canonicalizeDirectory: async (path) => {
        canonicalizeCalls.push(path);
        return canonicalPath;
      },
      removeDirectory: async (path, options) => {
        removeCalls.push({ path, options });
      },
    });

    expect(canonicalizeCalls).toEqual([rawPath]);
    expect(session.path).toBe(canonicalPath);

    await cleanupOwnedMarkdownPdfSession(session);
    expect(removeCalls).toEqual([
      { path: canonicalPath, options: { force: false, recursive: true } },
    ]);
  });

  test("removes only the raw directory when canonicalization fails", async () => {
    const rawPath = join("temporary-root-alias", "failed-session");
    const removeCalls: Array<{ path: string; options: unknown }> = [];

    await expect(
      createOwnedMarkdownPdfSession({
        createDirectory: async () => rawPath,
        canonicalizeDirectory: async () => {
          throw new Error("injected canonicalization failure");
        },
        removeDirectory: async (path, options) => {
          removeCalls.push({ path, options });
        },
      }),
    ).rejects.toThrow("injected canonicalization failure");
    expect(removeCalls).toEqual([{ path: rawPath, options: { force: false, recursive: true } }]);
  });

  test("preserves canonicalization and raw-cleanup failures without returning a session", async () => {
    const rawPath = join("temporary-root-alias", "failed-cleanup-session");
    const canonicalizationError = new Error("injected canonicalization failure");
    const cleanupError = new Error("injected raw cleanup failure");
    const removeCalls: Array<{ path: string; options: unknown }> = [];
    let returnedSession: OwnedMarkdownPdfSession | undefined;
    let thrown: unknown;

    try {
      returnedSession = await createOwnedMarkdownPdfSession({
        createDirectory: async () => rawPath,
        canonicalizeDirectory: async () => {
          throw canonicalizationError;
        },
        removeDirectory: async (path, options) => {
          removeCalls.push({ path, options });
          throw cleanupError;
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(returnedSession).toBeUndefined();
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).message).toBe(
      "Unable to canonicalize or remove the new Markdown PDF session.",
    );
    expect((thrown as AggregateError).errors).toEqual([canonicalizationError, cleanupError]);
    expect(removeCalls).toEqual([{ path: rawPath, options: { force: false, recursive: true } }]);
  });
});
