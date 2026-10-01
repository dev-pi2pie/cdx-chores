// Structural stream fixtures only; real encoder/pixel evidence is manual smoke.
export const pngChunk = (type: string, data = Buffer.alloc(0)) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type, 4);
  return Buffer.concat([header, data, Buffer.alloc(4)]);
};
export const png = () =>
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.alloc(13)),
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
  header.writeUInt32LE(14, 4);
  header.write("WEBP", 8);
  header.write(type, 12);
  header.writeUInt32LE(2, 16);
  return Buffer.concat([header, Buffer.from([0, 217])]);
};
