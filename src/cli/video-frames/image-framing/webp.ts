import { webpExtendedChunk, webpProfileChunk, type ImageProfile } from "../profile-chunks";
import { Header, invalidImageStream, type Framer, type ImageSink } from "./shared";

export class WebpFrames implements Framer {
  private header = new Header();
  private state: "signature" | "header" | "data" = "signature";
  private riff = 0;
  private remaining = 0;
  private type = "";
  private firstByte = false;
  private image = false;
  private signature = Buffer.alloc(0);
  private chunkHeader = Buffer.alloc(0);
  private prefixSize = 0;
  private initialized = false;
  private extended = false;
  private alpha = false;
  private alphaChunk = false;
  private chunks = 0;
  private padded = false;
  private profileChunk?: Buffer;
  constructor(
    private sink: ImageSink,
    private profile?: ImageProfile,
  ) {
    if (profile) this.profileChunk = webpProfileChunk(profile.icc);
  }
  private dimensions(width: number, height: number) {
    if (width !== this.profile!.width || height !== this.profile!.height)
      throw invalidImageStream();
  }
  private async prefix(bytes: Buffer) {
    let alpha = false;
    if (this.type === "VP8X") {
      if (bytes[0]! & 0xc3 || bytes.subarray(1, 4).some((byte) => byte !== 0))
        throw invalidImageStream();
      // Replacing an existing profile would require changing the declared RIFF size later.
      if (bytes[0]! & 32) throw invalidImageStream();
      this.dimensions(bytes.readUIntLE(4, 3) + 1, bytes.readUIntLE(7, 3) + 1);
      this.extended = true;
      this.alpha = !!(bytes[0]! & 16);
      bytes[0] = bytes[0]! | 32;
    } else if (this.type === "VP8L") {
      if (bytes[0] !== 0x2f || bytes[4]! & 0xe0) throw invalidImageStream();
      const bits = bytes.readUInt32LE(1);
      this.dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      alpha = !!(bits & 0x10000000);
      // VP8L's alpha bit is advisory. Existing VP8X flags remain authoritative.
      if (this.alphaChunk) throw invalidImageStream();
    } else {
      if (bytes[0]! & 1 || !bytes.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a])))
        throw invalidImageStream();
      this.dimensions(bytes.readUInt16LE(6) & 0x3fff, bytes.readUInt16LE(8) & 0x3fff);
      if (this.extended && this.alpha !== this.alphaChunk) throw invalidImageStream();
    }
    if (!this.initialized) {
      const overhead = this.profileChunk!.length + (this.extended ? 0 : 18);
      const size = this.signature.readUInt32LE(4) + overhead;
      if (size > 0xfffffff6) throw invalidImageStream();
      this.signature.writeUInt32LE(size, 4);
      await this.sink.write(this.signature);
      if (!this.extended) await this.sink.write(webpExtendedChunk(this.profile!, alpha));
      if (this.extended) {
        await this.sink.write(this.chunkHeader);
        await this.sink.write(bytes);
      }
      await this.sink.write(this.profileChunk!);
      this.initialized = true;
      if (this.extended) return;
    }
    await this.sink.write(this.chunkHeader);
    await this.sink.write(bytes);
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        let used: number;
        if (this.prefixSize) {
          used = this.header.take(value, offset, this.prefixSize);
          if (this.header.bytes.length === this.prefixSize) {
            await this.prefix(this.header.pop());
            this.prefixSize = 0;
          }
        } else {
          used = Math.min(value.length - offset, this.remaining);
          if (
            this.profile &&
            this.padded &&
            used === this.remaining &&
            value[offset + used - 1] !== 0
          )
            throw invalidImageStream();
          if (this.firstByte && this.type === "VP8X" && value[offset]! & 2)
            throw invalidImageStream();
          this.firstByte = false;
          await this.sink.write(value.subarray(offset, offset + used));
        }
        offset += used;
        this.remaining -= used;
        this.riff -= used;
        if (!this.remaining) {
          if (!this.riff) {
            if (!this.image) throw invalidImageStream();
            await this.sink.complete();
            this.state = "signature";
            this.image = false;
            this.initialized = false;
            this.extended = false;
            this.alpha = false;
            this.alphaChunk = false;
            this.chunks = 0;
          } else this.state = "header";
        }
        continue;
      }
      const required = this.state === "signature" ? 12 : 8;
      offset += this.header.take(value, offset, required);
      if (this.header.bytes.length !== required) continue;
      const header = this.header.pop();
      if (this.state === "signature") {
        if (
          header.toString("ascii", 0, 4) !== "RIFF" ||
          header.toString("ascii", 8, 12) !== "WEBP" ||
          header.readUInt32LE(4) < 12 ||
          (this.profile &&
            (header.readUInt32LE(4) % 2 !== 0 || header.readUInt32LE(4) > 0xfffffff6))
        )
          throw invalidImageStream();
        this.riff = header.readUInt32LE(4) - 4;
        await this.sink.begin();
        if (this.profile) this.signature = header;
        else await this.sink.write(header);
        this.state = "header";
      } else {
        this.riff -= 8;
        this.type = header.toString("ascii", 0, 4);
        const length = header.readUInt32LE(4);
        this.padded = length % 2 !== 0;
        this.remaining = length + (length % 2);
        if (
          !this.remaining ||
          this.remaining > this.riff ||
          this.type === "ANIM" ||
          this.type === "ANMF" ||
          (this.type === "VP8X" && length !== 10)
        )
          throw invalidImageStream();
        if (this.profile) {
          if (
            ++this.chunks > 4096 ||
            this.type === "ICCP" ||
            (!this.initialized && !["VP8X", "VP8 ", "VP8L"].includes(this.type)) ||
            (this.type === "VP8X" && this.chunks !== 1) ||
            (this.type === "ALPH" &&
              (!this.extended || !this.alpha || this.alphaChunk || this.image))
          )
            throw invalidImageStream();
          if (this.type === "ALPH") this.alphaChunk = true;
          this.prefixSize =
            this.type === "VP8L" ? 5 : ["VP8X", "VP8 "].includes(this.type) ? 10 : 0;
          if (length < this.prefixSize) throw invalidImageStream();
          this.chunkHeader = header;
        }
        if (this.type === "VP8 " || this.type === "VP8L") {
          if (this.image) throw invalidImageStream();
          this.image = true;
        }
        this.firstByte = true;
        if (!this.prefixSize) await this.sink.write(header);
        this.state = "data";
      }
    }
  }
  finish() {
    if (this.state !== "signature" || this.header.bytes.length) throw invalidImageStream();
  }
}
