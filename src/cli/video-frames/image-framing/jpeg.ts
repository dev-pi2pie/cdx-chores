import { jpegProfileSegments, type ImageProfile } from "../profile-chunks";
import { Header, invalidImageStream, type Framer, type ImageSink } from "./shared";

export class JpegFrames implements Framer {
  private header = new Header();
  private state: "signature" | "marker" | "length" | "data" | "entropy" | "entropy-marker" =
    "signature";
  private marker = 0;
  private remaining = 0;
  private scanned = false;
  private metadata = new Header();
  private pending: Buffer = Buffer.alloc(0);
  private inserted = false;
  private markers = 0;
  private profileSegments?: Buffer[];
  constructor(
    private sink: ImageSink,
    profile?: ImageProfile,
  ) {
    if (profile) this.profileSegments = jpegProfileSegments(profile.icc);
  }
  private async markerBytes(bytes: Buffer, entropy: boolean) {
    if (bytes[0] !== 255 || bytes[1] === 0) throw invalidImageStream();
    const marker = bytes[1]!;
    if (entropy && (marker === 0 || (marker >= 208 && marker <= 215))) {
      await this.sink.write(bytes);
      this.state = "entropy";
      return;
    }
    if (marker === 217) {
      if (!this.scanned) throw invalidImageStream();
      await this.sink.write(bytes);
      await this.sink.complete();
      this.state = "signature";
      this.scanned = false;
      this.inserted = false;
      this.markers = 0;
      return;
    }
    if (marker === 216 || marker === 255 || marker < 192 || (marker >= 208 && marker <= 215))
      throw invalidImageStream();
    if (this.profileSegments && ++this.markers > 4096) throw invalidImageStream();
    if (marker === 218 && this.profileSegments && !this.inserted) {
      for (const segment of this.profileSegments) await this.sink.write(segment);
      this.inserted = true;
    }
    this.marker = marker;
    if (marker === 226 && this.profileSegments) this.pending = bytes;
    else await this.sink.write(bytes);
    this.state = "length";
  }
  async chunk(value: Buffer) {
    let offset = 0;
    while (offset < value.length) {
      if (this.state === "data") {
        const used = Math.min(this.remaining, value.length - offset);
        if (this.pending.length)
          this.metadata.take(value, offset, this.metadata.bytes.length + used);
        else await this.sink.write(value.subarray(offset, offset + used));
        offset += used;
        this.remaining -= used;
        if (!this.remaining) {
          if (this.pending.length) {
            const metadata = this.metadata.pop();
            if (metadata.subarray(0, 11).equals(Buffer.from("ICC_PROFILE", "ascii")))
              throw invalidImageStream();
            await this.sink.write(this.pending);
            await this.sink.write(metadata);
            this.pending = Buffer.alloc(0);
          }
          if (this.marker === 218) {
            this.scanned = true;
            this.state = "entropy";
          } else this.state = "marker";
        }
        continue;
      }
      if (this.state === "entropy") {
        let cursor = offset;
        for (;;) {
          const found = value.indexOf(255, cursor);
          if (found < 0) {
            await this.sink.write(value.subarray(offset));
            offset = value.length;
            break;
          }
          if (found + 1 === value.length) {
            if (found > offset) await this.sink.write(value.subarray(offset, found));
            this.header.take(value, found, 2);
            offset = value.length;
            this.state = "entropy-marker";
            break;
          }
          const next = value[found + 1]!;
          if (next === 0 || (next >= 208 && next <= 215)) {
            cursor = found + 2;
            continue;
          }
          if (next === 255) {
            cursor = found + 1;
            continue;
          }
          if (found > offset) await this.sink.write(value.subarray(offset, found));
          await this.markerBytes(value.subarray(found, found + 2), true);
          offset = found + 2;
          break;
        }
        continue;
      }
      offset += this.header.take(value, offset, 2);
      if (this.header.bytes.length !== 2) continue;
      const bytes = this.header.pop();
      if (this.state === "signature") {
        if (bytes[0] !== 255 || bytes[1] !== 216) throw invalidImageStream();
        await this.sink.begin();
        await this.sink.write(bytes);
        this.state = "marker";
      } else if (this.state === "length") {
        const length = bytes.readUInt16BE(0);
        if (length < 2 || (this.marker === 218 && length < 3)) throw invalidImageStream();
        this.remaining = length - 2;
        if (this.pending.length) this.pending = Buffer.concat([this.pending, bytes]);
        else await this.sink.write(bytes);
        if (this.pending.length && !this.remaining) {
          await this.sink.write(this.pending);
          this.pending = Buffer.alloc(0);
        }
        this.state = this.remaining ? "data" : "marker";
      } else if (this.state === "entropy-marker" && bytes[1] === 255) {
        await this.sink.write(bytes.subarray(0, 1));
        this.header.take(bytes, 1, 2);
      } else if (
        this.state === "entropy-marker" &&
        (bytes[1] === 0 || (bytes[1]! >= 208 && bytes[1]! <= 215))
      ) {
        await this.sink.write(bytes);
        this.state = "entropy";
      } else await this.markerBytes(bytes, this.state === "entropy-marker");
    }
  }
  finish() {
    if (this.state !== "signature" || this.header.bytes.length) throw invalidImageStream();
  }
}
