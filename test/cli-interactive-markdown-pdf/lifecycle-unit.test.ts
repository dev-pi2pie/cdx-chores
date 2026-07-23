import { describe, expect, test } from "bun:test";
import { access, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import {
  cleanupOwnedMarkdownPdfSession,
  createOwnedMarkdownPdfSession,
  retainOwnedMarkdownPdfSession,
  type OwnedMarkdownPdfSession,
} from "../../src/cli/interactive/markdown/lifecycle";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("interactive Markdown PDF owned lifecycle", () => {
  test("removes only the exact factory-owned session root", async () => {
    const session = await createOwnedMarkdownPdfSession();
    const ownedFile = join(session.path, "profile.yml");
    const externalFile = join(dirname(session.path), `${basename(session.path)}-external.json`);
    await writeFile(ownedFile, "profile: true\n");
    await writeFile(externalFile, "{}\n");

    expect(dirname(session.path)).toBe(await realpath(tmpdir()));
    expect(basename(session.path).startsWith("cdx-chores-markdown-pdf-")).toBe(true);
    await cleanupOwnedMarkdownPdfSession(session);

    expect(session.state).toBe("removed");
    expect(await pathExists(session.path)).toBe(false);
    expect(await pathExists(externalFile)).toBe(true);
    await rm(externalFile);
  });

  test("retains an owned session and its diagnostics", async () => {
    const session = await createOwnedMarkdownPdfSession();
    const diagnostic = join(session.path, "renderer.log");
    await writeFile(diagnostic, "failed\n");

    retainOwnedMarkdownPdfSession(session);

    expect(session.state).toBe("retained");
    expect(await pathExists(diagnostic)).toBe(true);
    await cleanupOwnedMarkdownPdfSession(session);
  });

  test("keeps the exact path retained when cleanup fails", async () => {
    let removeAttempts = 0;
    const session = await createOwnedMarkdownPdfSession({
      removeDirectory: async (path, options) => {
        removeAttempts += 1;
        if (removeAttempts === 1) {
          throw new Error("injected cleanup failure");
        }
        await rm(path, options);
      },
    });
    const ownedPath = session.path;

    await expect(cleanupOwnedMarkdownPdfSession(session)).rejects.toThrow(
      "injected cleanup failure",
    );
    expect(session.state).toBe("retained");
    expect(session.path).toBe(ownedPath);
    expect(await pathExists(ownedPath)).toBe(true);

    await cleanupOwnedMarkdownPdfSession(session);
    expect(session.state).toBe("removed");
  });

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

  test("fails closed for a raw path disguised as a session", async () => {
    const session = await createOwnedMarkdownPdfSession();
    const rawSession = {
      path: session.path,
      state: "active",
    } as unknown as OwnedMarkdownPdfSession;

    await expect(cleanupOwnedMarkdownPdfSession(rawSession)).rejects.toThrow(
      "Expected a CLI-owned Markdown PDF session",
    );
    expect(await pathExists(session.path)).toBe(true);
    await cleanupOwnedMarkdownPdfSession(session);
  });
});
