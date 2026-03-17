declare module "yauzl" {
  import { EventEmitter } from "node:events";
  import { Readable } from "node:stream";

  export interface Options {
    autoClose?: boolean;
    decodeStrings?: boolean;
    lazyEntries?: boolean;
    validateEntrySizes?: boolean;
  }

  export interface Entry {
    compressedSize: number;
    fileName: string;
    uncompressedSize: number;
  }

  export class ZipFile extends EventEmitter {
    close(): void;
    openReadStream(
      entry: Entry,
      callback: (error: Error | null, stream?: Readable | null) => void,
    ): void;
    readEntry(): void;
  }

  export interface Yauzl {
    fromBuffer(
      buffer: Buffer,
      options: Options,
      callback: (error: Error | null, zipFile?: ZipFile | null) => void,
    ): void;
  }

  const yauzl: Yauzl;
  export default yauzl;
}
