import { expect, test } from "bun:test";
import type { FileHandle } from "node:fs/promises";
import { ImageStager, IMAGE_STAGING_LIMITS } from "../../../src/cli/video-frames/staging";
import type { PublicationSession, StageFile } from "../../../src/cli/video-frames/publication";
import { imageRgbProfile } from "../../../src/cli/video-frames/color-profile";
import { pngProfileChunk } from "../../../src/cli/video-frames/profile-chunks";
import { segmentedPng } from "./fixtures/framing";

// Virtual storage exercises the real framer/stager and default accounting without
// allocating or persisting a 256-MiB image. Native small-image writes are separate evidence.
function virtualStorage() {
  const files = new Map<string, StageFile>();
  let written = 0,
    admitted = 0,
    maximumChunk = 0;
  const session = {
    files,
    signal: new AbortController().signal,
    async openStage(index: number) {
      const file: StageFile = {
        path: String(index),
        bytes: 0,
        handle: {
          async write(_buffer: Buffer, _offset: number, length: number) {
            admitted += length;
            maximumChunk = Math.max(maximumChunk, length);
            return { bytesWritten: length };
          },
        } as unknown as FileHandle,
      };
      files.set(file.path, file);
      return file;
    },
    async closeStage() {},
    async publish() {
      written++;
    },
    async removeStage(file: StageFile) {
      files.delete(file.path);
    },
    async settle() {},
  } as unknown as PublicationSession;
  return { session, state: () => ({ written, admitted, maximumChunk }) };
}

async function streamPng(writer: ImageStager, total: number) {
  const prefix = Buffer.alloc(41);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(prefix);
  prefix.writeUInt32BE(13, 8);
  prefix.write("IHDR", 12);
  prefix.writeUInt32BE(total - 57, 33);
  prefix.write("IDAT", 37);
  await writer.chunk(prefix);
  const block = Buffer.alloc(64 * 1024);
  for (let remaining = total - 57; remaining > 0;) {
    const size = Math.min(block.length, remaining);
    await writer.chunk(block.subarray(0, size));
    remaining -= size;
  }
  const end = Buffer.alloc(16);
  end.write("IEND", 8);
  await writer.chunk(end);
  await writer.finish();
}

test("default staging admits the exact 256-MiB encoded byte boundary with bounded chunks", async () => {
  const storage = virtualStorage();
  const writer = new ImageStager(storage.session, "png", () => "image.png");
  await streamPng(writer, 256 * 1024 * 1024);
  expect(storage.state().written).toBe(1);
  expect(storage.state().admitted).toBe(256 * 1024 * 1024);
  expect(storage.state().maximumChunk).toBeLessThanOrEqual(64 * 1024);
  expect(writer.peaks).toEqual({ files: 1, bytes: IMAGE_STAGING_LIMITS.bytes });
  expect(storage.session.files.size).toBe(0);
});

test("one byte above the default staging ceiling fails before publication or excess writes", async () => {
  const storage = virtualStorage();
  const writer = new ImageStager(storage.session, "png", () => "image.png");
  await expect(streamPng(writer, 256 * 1024 * 1024 + 1)).rejects.toMatchObject({
    code: "FRAME_STAGING_LIMIT",
  });
  await writer.settle();
  expect(storage.state().written).toBe(0);
  expect(storage.state().admitted).toBeLessThanOrEqual(256 * 1024 * 1024);
  expect(writer.peaks.bytes).toBeLessThanOrEqual(IMAGE_STAGING_LIMITS.bytes);
});

test("many PNG IDAT chunks remain bounded by staged container and profile bytes", async () => {
  const source = segmentedPng();
  const profile = { icc: imageRgbProfile("srgb"), width: source.width, height: source.height };
  const total = source.bytes.length + pngProfileChunk(profile.icc).length;
  for (const limit of [total, total - 1]) {
    const storage = virtualStorage();
    const writer = new ImageStager(storage.session, "png", () => "image.png", {
      bytes: limit,
      profile,
    });
    const exporting = async () => {
      for (let offset = 0; offset < source.bytes.length; offset += 4093)
        await writer.chunk(source.bytes.subarray(offset, offset + 4093));
      await writer.finish();
    };
    if (limit === total) {
      await exporting();
      expect(storage.state().written).toBe(1);
      expect(storage.state().admitted).toBe(total);
      expect(storage.session.files.size).toBe(0);
    } else {
      await expect(exporting()).rejects.toMatchObject({ code: "FRAME_STAGING_LIMIT" });
      await writer.settle();
      expect(storage.state().written).toBe(0);
      expect(storage.state().admitted).toBeLessThanOrEqual(limit);
    }
    expect(writer.peaks.bytes).toBeLessThanOrEqual(limit);
  }
});
