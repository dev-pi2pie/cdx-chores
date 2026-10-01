import { constants, type BigIntStats } from "node:fs";
import {
  link,
  rename,
  open,
  lstat,
  stat,
  realpath,
  mkdir,
  mkdtemp,
  readdir,
  unlink,
  rmdir,
  type FileHandle,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { CliError } from "../errors";
import { assertNoSymlinkPathParents } from "../file-io";
import { inspectSource, type SourceSnapshot } from "./source";

export interface StageFile {
  path: string;
  bytes: number;
  handle?: FileHandle;
  identity?: { dev: bigint; ino: bigint };
}
export interface PublicationIO {
  link: typeof link;
  rename: typeof rename;
  open: typeof open;
  unlink: typeof unlink;
}
const notFound = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
const same = (a: { dev: bigint; ino: bigint }, b: { dev: bigint; ino: bigint }) =>
  a.dev === b.dev && a.ino === b.ino;
export async function canonicalFolder(path: string): Promise<string> {
  let parent = resolve(path);
  const missing: string[] = [];
  for (;;) {
    try {
      const entry = await stat(parent);
      if (!entry.isDirectory())
        throw new CliError("Image destination must be a folder.", { code: "FRAME_TARGET_KIND" });
      return join(await realpath(parent), ...missing.toReversed());
    } catch (error) {
      if (!notFound(error)) throw error;
      missing.push(basename(parent));
      const next = dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
}
export function assertImageBasename(name: string) {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    basename(name) !== name ||
    /[\\\p{Cc}]/u.test(name) ||
    Buffer.byteLength(name) > 255
  )
    throw new CliError("Image filename must be a safe basename within filesystem limits.", {
      code: "FRAME_NAME_INVALID",
    });
}

/** Owns staging only; completed and incomplete destination files survive failure. */
export class PublicationSession {
  readonly files = new Map<string, StageFile>();
  readonly io: PublicationIO;
  written = 0;
  incomplete?: string;
  private handlesUnconfirmed = false;
  private constructor(
    readonly root: string,
    readonly staging: string,
    private rootOwner: BigIntStats,
    private stageOwner: BigIntStats,
    private sourcePath: string,
    private source: SourceSnapshot,
    private overwrite: boolean,
    readonly signal: AbortSignal,
    io?: Partial<PublicationIO>,
    private onWritten?: (written: number) => void,
  ) {
    this.io = { link, rename, open, unlink, ...io };
  }
  static async create(input: {
    folder: string;
    sourcePath: string;
    source: SourceSnapshot;
    overwrite?: boolean;
    signal: AbortSignal;
    io?: Partial<PublicationIO>;
    onWritten?: (written: number) => void;
  }): Promise<PublicationSession> {
    input.signal.throwIfAborted();
    const root = await canonicalFolder(input.folder);
    await assertNoSymlinkPathParents({ path: join(root, "image"), label: "Image output" });
    await mkdir(root, { recursive: true });
    const owner = await lstat(root, { bigint: true });
    if (!owner.isDirectory() || owner.isSymbolicLink() || (await realpath(root)) !== root)
      throw ownership();
    const staging = await mkdtemp(join(root, ".cdx-frames-"));
    const stageOwner = await lstat(staging, { bigint: true });
    return new PublicationSession(
      root,
      staging,
      owner,
      stageOwner,
      input.sourcePath,
      input.source,
      input.overwrite ?? false,
      input.signal,
      input.io,
      input.onWritten,
    );
  }
  async checkRoot() {
    const current = await lstat(this.root, { bigint: true });
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      !same(current, this.rootOwner) ||
      (await realpath(this.root)) !== this.root
    )
      throw ownership();
  }
  async checkSource() {
    this.signal.throwIfAborted();
    if ((await inspectSource(this.sourcePath)).fingerprint !== this.source.fingerprint)
      throw new CliError("Video source changed; select again.", { code: "FRAME_SOURCE_CHANGED" });
  }
  async checkTarget(name: string): Promise<string> {
    assertImageBasename(name);
    await this.checkRoot();
    await this.checkSource();
    const target = join(this.root, name);
    if (target === this.source.canonicalPath) throw sourceAlias();
    let existing: BigIntStats;
    try {
      existing = await lstat(target, { bigint: true });
    } catch (error) {
      if (notFound(error)) return target;
      throw error;
    }
    if (existing.isSymbolicLink() || !existing.isFile())
      throw new CliError("Image target must be an ordinary file.", { code: "FRAME_TARGET_KIND" });
    if (same(existing, await stat(this.source.canonicalPath, { bigint: true })))
      throw sourceAlias();
    if (!this.overwrite)
      throw new CliError("Image target already exists; choose a fresh name or enable overwrite.", {
        code: "FRAME_OUTPUT_EXISTS",
      });
    return target;
  }
  private async checkStaging() {
    await this.checkRoot();
    const current = await lstat(this.staging, { bigint: true });
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      !same(current, this.stageOwner) ||
      (await realpath(this.staging)) !== this.staging
    )
      throw ownership();
  }
  async openStage(serial: number): Promise<StageFile> {
    this.signal.throwIfAborted();
    await this.checkStaging();
    const path = join(this.staging, `image-${serial}.stage`);
    const handle = await this.io.open(path, "wx", 0o600);
    const file: StageFile = { path, handle, bytes: 0 };
    this.files.set(path, file);
    file.identity = await handle.stat({ bigint: true });
    return file;
  }
  async closeStage(file: StageFile) {
    if (!file.handle) return;
    const handle = file.handle;
    try {
      await handle.close();
    } finally {
      if (handle.fd < 0) file.handle = undefined;
    }
  }
  private async checkFile(file: StageFile): Promise<BigIntStats> {
    await this.checkStaging();
    const current = await lstat(file.path, { bigint: true });
    if (
      this.files.get(file.path) !== file ||
      !file.identity ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      !same(current, file.identity)
    )
      throw ownership();
    return current;
  }
  async publish(file: StageFile, name: string) {
    if (file.handle)
      throw new CliError("Image write is not closed.", { code: "FRAME_IMAGE_INCOMPLETE" });
    const staged = await this.checkFile(file);
    if (staged.size !== BigInt(file.bytes)) throw ownership();
    const target = await this.checkTarget(name);
    if (this.written >= Number.MAX_SAFE_INTEGER)
      throw new CliError("Written image count exceeds the safe integer limit.", {
        code: "FRAME_NUMERIC_LIMIT",
      });
    if (this.overwrite) await this.io.rename(file.path, target);
    else {
      try {
        await this.io.link(file.path, target);
      } catch (error) {
        if (
          !["ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EPERM", "EXDEV"].includes(
            (error as NodeJS.ErrnoException)?.code ?? "",
          )
        )
          throw error;
        await this.copyExclusive(file, target);
      }
    }
    this.written++;
    if (this.overwrite) this.files.delete(file.path);
    this.onWritten?.(this.written);
  }
  private async copyExclusive(file: StageFile, target: string) {
    const input = await this.io.open(file.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let output: FileHandle | undefined;
    let failure: unknown;
    try {
      if (!file.identity || !same(await input.stat({ bigint: true }), file.identity))
        throw ownership();
      output = await this.io.open(
        target,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      this.incomplete = target;
      const identity = await output.stat({ bigint: true });
      const chunk = Buffer.alloc(65536);
      for (;;) {
        this.signal.throwIfAborted();
        const { bytesRead } = await input.read(chunk, 0, chunk.length, null);
        if (!bytesRead) break;
        for (let offset = 0; offset < bytesRead;) {
          this.signal.throwIfAborted();
          const { bytesWritten } = await output.write(chunk, offset, bytesRead - offset);
          if (!bytesWritten) throw new Error("Image copy made no progress.");
          offset += bytesWritten;
        }
      }
      await output.close();
      output = undefined;
      if (!same(await lstat(target, { bigint: true }), identity)) throw ownership();
    } catch (error) {
      failure = error;
    } finally {
      try {
        await output?.close();
      } catch (error) {
        failure ??= error;
        this.handlesUnconfirmed ||= output !== undefined && output.fd >= 0;
      }
      try {
        await input.close();
      } catch (error) {
        failure ??= error;
        this.handlesUnconfirmed ||= input.fd >= 0;
      }
    }
    if (failure) throw failure;
    this.incomplete = undefined;
  }
  async removeStage(file: StageFile) {
    if (!this.files.has(file.path)) return; // Rename already consumed it.
    if (file.handle) throw ownership();
    await this.checkFile(file);
    await this.io.unlink(file.path);
    this.files.delete(file.path);
  }
  async settle() {
    const results = await Promise.allSettled(
      [...this.files.values()].map((file) => this.closeStage(file)),
    );
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
  }
  async cleanup(closureConfirmed: boolean) {
    if (
      !closureConfirmed ||
      this.handlesUnconfirmed ||
      [...this.files.values()].some((file) => file.handle)
    )
      throw ownership();
    await this.checkStaging();
    const entries = await readdir(this.staging);
    if (entries.some((name) => !this.files.has(join(this.staging, name)))) throw ownership();
    for (const file of this.files.values()) await this.removeStage(file);
    await rmdir(this.staging);
  }
}
function ownership() {
  return new CliError(
    "Image staging/destination ownership is uncertain; retain scratch and stop.",
    { code: "FRAME_OWNERSHIP_UNCONFIRMED", exitCode: 2 },
  );
}
function sourceAlias() {
  return new CliError("Image target aliases the video source; choose another target.", {
    code: "FRAME_SOURCE_ALIAS",
  });
}
