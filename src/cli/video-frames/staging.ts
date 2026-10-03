import { CliError } from "../errors";
import { imageFramer, type ImageProfile } from "./image-framing";
import type { ImageFormat } from "./image-options";
import { PublicationSession, type StageFile } from "./publication";
export const IMAGE_STAGING_LIMITS = { files: 2, bytes: 256 * 1024 * 1024 } as const;
export class ImageStager {
  readonly peaks = { files: 0, bytes: 0 };
  private current?: StageFile;
  private serial = 0;
  private bytes = 0;
  private pending: Promise<void>[] = [];
  private tail: Promise<void> = Promise.resolve();
  private failure?: unknown;
  private framer: ReturnType<typeof imageFramer>;
  constructor(
    readonly session: PublicationSession,
    format: ImageFormat,
    private target: (index: number) => string,
    private options: {
      bytes?: number;
      profile?: ImageProfile;
      onFailure?: (error: unknown) => void;
    } = {},
  ) {
    const limit = options.bytes ?? IMAGE_STAGING_LIMITS.bytes;
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid image staging limit.");
    this.framer = imageFramer(
      format,
      {
        begin: () => this.begin(),
        write: (bytes) => this.write(bytes),
        complete: () => this.complete(),
      },
      options.profile,
    );
  }
  private check() {
    this.session.signal.throwIfAborted();
    if (this.failure) throw this.failure;
  }
  private async capacity(additional: number) {
    const limit = this.options.bytes ?? IMAGE_STAGING_LIMITS.bytes;
    if ((this.current?.bytes ?? 0) + additional > limit) throw stagingLimit();
    while (this.bytes + additional > limit && this.pending.length) {
      await this.pending[0];
      this.check();
    }
    if (this.bytes + additional > limit) throw stagingLimit();
  }
  private async begin() {
    this.check();
    if (this.session.files.size >= IMAGE_STAGING_LIMITS.files) {
      await this.pending[0];
      this.check();
    }
    if (this.session.files.size >= IMAGE_STAGING_LIMITS.files) throw stagingLimit();
    if (this.serial >= Number.MAX_SAFE_INTEGER)
      throw new CliError("Image ordinal exceeds safe integer limit.", {
        code: "FRAME_NUMERIC_LIMIT",
      });
    this.current = await this.session.openStage(++this.serial);
    this.peaks.files = Math.max(this.peaks.files, this.session.files.size);
  }
  private async write(value: Buffer) {
    this.check();
    await this.capacity(value.length);
    this.check();
    const file = this.current!;
    this.bytes += value.length;
    file.bytes += value.length;
    this.peaks.bytes = Math.max(this.peaks.bytes, this.bytes);
    for (let offset = 0; offset < value.length;) {
      this.check();
      const { bytesWritten } = await file.handle!.write(value, offset, value.length - offset);
      if (!bytesWritten) throw new Error("Image staging write made no progress.");
      offset += bytesWritten;
    }
  }
  private async complete() {
    const file = this.current!;
    await this.session.closeStage(file);
    this.current = undefined;
    const name = this.target(this.serial);
    const publication = this.tail.then(async () => {
      this.check();
      await this.session.publish(file, name);
      await this.session.removeStage(file);
      this.bytes -= file.bytes;
    });
    this.tail = publication;
    this.pending.push(publication);
    void publication.then(
      () => {
        this.pending.splice(this.pending.indexOf(publication), 1);
      },
      (error) => {
        this.failure ??= error;
        this.options.onFailure?.(error);
      },
    );
  }
  async chunk(value: Buffer) {
    this.check();
    await this.framer.chunk(value);
  }
  async finish() {
    this.framer.finish();
    await this.tail;
    this.check();
  }
  async settle() {
    await Promise.allSettled(this.pending);
    await this.session.settle();
  }
}
function stagingLimit() {
  return new CliError("Encoded image staging exceeds its file/byte capacity.", {
    code: "FRAME_STAGING_LIMIT",
  });
}
