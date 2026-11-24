import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const load = createRequire(import.meta.url);

export type HeadingPaint = "clear" | "clipped" | "covered" | "beside" | "transparent";

function stream(data: Buffer, attributes = "") {
  return Buffer.concat([
    Buffer.from(`<< ${attributes} /Length ${data.length} >>\nstream\n`),
    data,
    Buffer.from("\nendstream"),
  ]);
}

interface PageOptions {
  coincident?: boolean;
  earlier?: "hidden" | "revealed";
  laterPage?: boolean;
  wrapped?: boolean;
}

/** A tagged H1 with a named destination and independently positioned text runs. */
export function taggedTitlePdf(
  runs: readonly string[],
  paint: HeadingPaint,
  options: PageOptions = {},
) {
  const font = readFileSync(load.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"));
  const content = ["q"];
  if (options.earlier) {
    content.push(`/Span << /MCID ${runs.length} >> BDC`);
    if (options.earlier === "revealed")
      content.push("BT /Font 18 Tf 1 0 0 1 20 145 Tm (Earlier) Tj ET");
    content.push("EMC");
  }
  if (paint === "clipped") content.push("0 110 220 60 re W n");
  if (paint === "transparent") content.push("/Invisible gs");
  content.push("0.1 0.1 0.1 rg");
  runs.forEach((text, i) => {
    // TJ adjustments space the letters without introducing source spaces.
    const letters = Array.from(text, (letter) => `(${letter})`).join(" -250 ");
    const position = options.wrapped ? `20 ${100 - i * 32}` : `${20 + 75 * i} 100`;
    content.push(
      `/Span << /MCID ${i} >> BDC BT /Font 22 Tf 1 0 0 1 ${position} Tm [${letters}] TJ ET EMC`,
    );
  });
  content.push("Q");
  if (paint === "covered" || paint === "beside") {
    content.push(`1 1 1 rg ${paint === "covered" ? 20 : 170} 106 125 4 re f`);
  }

  const ids = runs.map((_, i) => i).join(" ");
  const destination = "[3 0 R /XYZ 20 120 null]";
  const earlierDestination = options.earlier ? "(earlier) [3 0 R /XYZ 20 160 null]" : "";
  const otherDestination = options.coincident ? "(other) " + destination : "";
  const dictionary = [
    `<< /Type /Catalog /Pages 2 0 R /StructTreeRoot 5 0 R /MarkInfo << /Marked true >> /Names << /Dests << /Names [${earlierDestination} ${otherDestination} (report) ${destination}] >> >> >>`,
    options.laterPage
      ? "<< /Type /Pages /Kids [3 0 R 14 0 R] /Count 2 >>"
      : "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Contents 4 0 R /StructParents 0 /Resources << /Font << /Font 10 0 R >> /ExtGState << /Invisible << /ca 0 >> >> >> >>",
    stream(Buffer.from(content.join("\n"))),
    "<< /Type /StructTreeRoot /K 6 0 R /ParentTree 9 0 R >>",
    "<< /Type /StructElem /S /Document /P 5 0 R /K 7 0 R >>",
    `<< /Type /StructElem /S /Part /P 6 0 R /K [${options.earlier ? "13 0 R" : ""} 8 0 R] >>`,
    `<< /Type /StructElem /S /H1 /P 7 0 R /Pg 3 0 R /K [${ids}] >>`,
    `<< /Nums [0 [${runs.map(() => "8 0 R").join(" ")} ${options.earlier ? "13 0 R" : ""}]] >>`,
    `<< /Type /Font /Subtype /TrueType /BaseFont /LiberationSans /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 126 /Widths [${Array(95).fill(650).join(" ")}] /FontDescriptor 11 0 R >>`,
    "<< /Type /FontDescriptor /FontName /LiberationSans /Flags 32 /FontBBox [-545 -304 1301 980] /Ascent 905 /Descent -212 /CapHeight 688 /ItalicAngle 0 /StemV 80 /FontFile2 12 0 R >>",
    stream(font, `/Length1 ${font.length}`),
    options.earlier
      ? `<< /Type /StructElem /S /H1 /P 7 0 R /Pg 3 0 R /K ${runs.length} >>`
      : "null",
  ];
  if (options.laterPage)
    dictionary.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Contents 15 0 R /Resources << /Font << /Font 10 0 R >> >> >>",
      stream(Buffer.from("BT /Font 12 Tf 1 0 0 1 20 120 Tm (Later body) Tj ET")),
    );
  const chunks = [Buffer.from("%PDF-1.7\n")];
  let size = chunks[0]!.length;
  const offsets = ["0000000000 65535 f "];
  dictionary.forEach((object, i) => {
    offsets.push(String(size).padStart(10, "0") + " 00000 n ");
    const bytes = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      Buffer.from(object),
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(bytes);
    size += bytes.length;
  });
  chunks.push(
    Buffer.from(
      `xref\n0 ${offsets.length}\n${offsets.join("\n")}\ntrailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(chunks);
}
