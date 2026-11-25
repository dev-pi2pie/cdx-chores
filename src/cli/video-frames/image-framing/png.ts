import { crc32 } from "node:zlib";

import { MAX_PROFILE_BYTES, pngProfileChunk, type ImageProfile } from "../profile-chunks";
import { Header, invalidImageStream, type Framer, type ImageSink } from "./shared";

export class PngFrames implements Framer {
  private header = new Header();
  private state: "signature" | "header" | "data" = "signature";
  private remaining = 0;
  private type = "";
  private first = true;
  private data = false;
  private metadata = new Header();
  private seen = new Set<string>();
  private capture = false;
  private nonDataChunks = 0;
  private profileChunk?: Buffer;
  constructor(
    private sink: ImageSink,
    private profile?: ImageProfile,
  ) {
    if (profile) this.profileChunk = pngProfileChunk(profile.icc);
  }
  private async capturedChunk() {
    const bytes = this.metadata.pop();
    if (crc32(bytes.subarray(4, -4)) !== bytes.readUInt32BE(bytes.length - 4))
      throw invalidImageStream();
    const body = bytes.subarray(8, -4);
    if (this.type === "IHDR") {
      if (
        body.readUInt32BE(0) !== this.profile!.width ||
        body.readUInt32BE(4) !== this.profile!.height ||
        body[8] !== 8 ||
        (body[9] !== 2 && body[9] !== 6) ||
        body[10] !== 0 ||
        body[11] !== 0 ||
        body[12]! > 1
      )
        throw invalidImageStream();
      await this.sink.write(bytes);
      await this.sink.write(this.profileChunk!);
    } else if (this.type === "iCCP") {
      const nul = body.indexOf(0);
      if (
        nul < 1 ||
        nul > 79 ||
        body[nul + 1] !== 0 ||
        body.length < nul + 4 ||
        (body[nul + 2]! & 15) !== 8 ||
        body[nul + 2]! >>> 4 > 7 ||
        !!(body[nul + 3]! & 32) ||
        ((body[nul + 2]! << 8) | body[nul + 3]!) % 31 !== 0
      )
        throw invalidImageStream();
    } else if (this.type === "sRGB" && body[0]! > 3) throw invalidImageStream();
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(value.length - offset, this.remaining);
        if (this.capture) this.metadata.take(value, offset, this.metadata.bytes.length + used);
        else await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        if (!this.remaining) {
          if (this.capture) await this.capturedChunk();
          if (this.type === "IEND") {
            if (!this.data) throw invalidImageStream();
            await this.sink.complete();
            this.state = "signature";
            this.first = true;
            this.data = false;
            this.seen.clear();
            this.nonDataChunks = 0;
          } else this.state = "header";
        }
        continue;
      }
      offset += this.header.take(value, offset, 8);
      if (this.header.bytes.length !== 8) continue;
      const header = this.header.pop();
      if (this.state === "signature") {
        if (!header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          throw invalidImageStream();
        await this.sink.begin();
        await this.sink.write(header);
        this.state = "header";
      } else {
        const length = header.readUInt32BE(0);
        this.type = header.toString("ascii", 4, 8);
        if (
          !/^[a-zA-Z]{4}$/.test(this.type) ||
          (this.first && (this.type !== "IHDR" || length !== 13)) ||
          (!this.first && this.type === "IHDR") ||
          (this.type === "IEND" && length !== 0)
        )
          throw invalidImageStream();
        this.capture =
          !!this.profile && ["IHDR", "iCCP", "sRGB", "cICP", "gAMA", "cHRM"].includes(this.type);
        if (this.profile) {
          if (
            // IDAT streams through the sink's byte limit; encoded size determines its count.
            (this.type !== "IDAT" && ++this.nonDataChunks > 4096) ||
            length > 0x7fffffff ||
            ["acTL", "fcTL", "fdAT"].includes(this.type)
          )
            throw invalidImageStream();
          if (this.capture) {
            const fixed = { IHDR: 13, sRGB: 1, cICP: 4, gAMA: 4, cHRM: 32 }[this.type];
            if (
              this.data ||
              this.seen.has(this.type) ||
              (fixed !== undefined && length !== fixed) ||
              (this.type === "iCCP" && (length < 4 || length > MAX_PROFILE_BYTES))
            )
              throw invalidImageStream();
            this.seen.add(this.type);
          }
        }
        this.first = false;
        this.data ||= this.type === "IDAT";
        this.remaining = length + 4;
        if (this.capture) this.metadata.take(header, 0, 8);
        else await this.sink.write(header);
        this.state = "data";
      }
    }
  }
  finish() {
    if (this.state !== "signature" || this.header.bytes.length) throw invalidImageStream();
  }
}
