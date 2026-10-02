// Structural stream fixtures only; real encoder/pixel evidence is manual smoke.
export const pngChunk = (type: string, data: Buffer = Buffer.alloc(0)) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type, 4);
  const bytes = Buffer.concat([header, data, Buffer.alloc(4)]);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  bytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length - 4);
  return bytes;
};
export const pngHeader = () => {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(2);
  data.writeUInt32BE(2, 4);
  data[8] = 8;
  data[9] = 6;
  return pngChunk("IHDR", data);
};
export const png = () =>
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngHeader(),
    pngChunk("IDAT", Buffer.from("IEND\xff\xd9")),
    pngChunk("IEND"),
  ]);
export const jpg = () =>
  Buffer.from([
    255, 216, 255, 225, 0, 6, 255, 217, 20, 30, 255, 218, 0, 3, 0, 10, 255, 0, 217, 30, 255, 208,
    20, 255, 217,
  ]);
export const webp = (type = "VP8L") => {
  const header = Buffer.alloc(20);
  header.write("RIFF");
  header.writeUInt32LE(18, 4);
  header.write("WEBP", 8);
  header.write(type, 12);
  header.writeUInt32LE(5, 16);
  const data = Buffer.alloc(6);
  data[0] = 0x2f;
  data.writeUInt32LE(1 | (1 << 14), 1);
  return Buffer.concat([header, data]);
};
