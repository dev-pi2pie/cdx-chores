import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OWNED_MARKDOWN_PDF_SESSION_PREFIX = "cdx-chores-markdown-pdf-";
const ownedMarkdownPdfSessionBrand: unique symbol = Symbol("OwnedMarkdownPdfSession");

export type OwnedMarkdownPdfSessionState = "active" | "retained" | "removed";

export interface OwnedMarkdownPdfSession {
  readonly path: string;
  readonly state: OwnedMarkdownPdfSessionState;
  readonly [ownedMarkdownPdfSessionBrand]: true;
}

interface OwnedMarkdownPdfSessionRecord {
  readonly path: string;
  readonly remove: RemoveOwnedMarkdownPdfSessionDirectory;
  state: OwnedMarkdownPdfSessionState;
}

type CreateOwnedMarkdownPdfSessionDirectory = (prefix: string) => Promise<string>;
type CanonicalizeOwnedMarkdownPdfSessionDirectory = (path: string) => Promise<string>;
type RemoveOwnedMarkdownPdfSessionDirectory = (
  path: string,
  options: { readonly force: false; readonly recursive: true },
) => Promise<void>;

export interface OwnedMarkdownPdfSessionDependencies {
  readonly createDirectory?: CreateOwnedMarkdownPdfSessionDirectory;
  readonly canonicalizeDirectory?: CanonicalizeOwnedMarkdownPdfSessionDirectory;
  readonly removeDirectory?: RemoveOwnedMarkdownPdfSessionDirectory;
}

const ownedSessions = new WeakMap<OwnedMarkdownPdfSession, OwnedMarkdownPdfSessionRecord>();

function ownedSessionRecord(session: OwnedMarkdownPdfSession): OwnedMarkdownPdfSessionRecord {
  const record = ownedSessions.get(session);
  if (!record) {
    throw new TypeError("Expected a CLI-owned Markdown PDF session.");
  }
  return record;
}

export async function createOwnedMarkdownPdfSession(
  dependencies: OwnedMarkdownPdfSessionDependencies = {},
): Promise<OwnedMarkdownPdfSession> {
  const createDirectory = dependencies.createDirectory ?? mkdtemp;
  const canonicalizeDirectory = dependencies.canonicalizeDirectory ?? realpath;
  const removeDirectory = dependencies.removeDirectory ?? rm;
  const rawPath = await createDirectory(join(tmpdir(), OWNED_MARKDOWN_PDF_SESSION_PREFIX));
  let path: string;
  try {
    path = await canonicalizeDirectory(rawPath);
  } catch (canonicalizationError) {
    try {
      await removeDirectory(rawPath, { force: false, recursive: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [canonicalizationError, cleanupError],
        "Unable to canonicalize or remove the new Markdown PDF session.",
      );
    }
    throw canonicalizationError;
  }
  const record: OwnedMarkdownPdfSessionRecord = {
    path,
    remove: removeDirectory,
    state: "active",
  };
  const session = Object.freeze({
    get path(): string {
      return record.path;
    },
    get state(): OwnedMarkdownPdfSessionState {
      return record.state;
    },
    [ownedMarkdownPdfSessionBrand]: true as const,
  });
  ownedSessions.set(session, record);
  return session;
}

export function assertActiveOwnedMarkdownPdfSession(session: OwnedMarkdownPdfSession): void {
  const record = ownedSessionRecord(session);
  if (record.state !== "active") {
    throw new TypeError(`Markdown PDF session is ${record.state}, not active.`);
  }
}

export function retainOwnedMarkdownPdfSession(session: OwnedMarkdownPdfSession): void {
  const record = ownedSessionRecord(session);
  if (record.state === "removed") {
    throw new TypeError("Cannot retain a removed Markdown PDF session.");
  }
  record.state = "retained";
}

export async function cleanupOwnedMarkdownPdfSession(
  session: OwnedMarkdownPdfSession,
): Promise<void> {
  const record = ownedSessionRecord(session);
  if (record.state === "removed") {
    return;
  }
  try {
    await record.remove(record.path, { force: false, recursive: true });
    record.state = "removed";
  } catch (error) {
    record.state = "retained";
    throw error;
  }
}
