/** Deterministic, stored ZIP fixtures; mirrors the existing OOXML metadata tests. */
export type ZipEntry = [string, string | Buffer];

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let round = 0; round < 8; round += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildStoredZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  // 2026-10-16 00:00:00 UTC, with no host-clock or filesystem dependencies.
  const date = ((2026 - 1980) << 9) | (10 << 5) | 16;

  for (const [name, content] of entries) {
    const filename = Buffer.from(name, "utf8");
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    localParts.push(local, filename, bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, filename);
    offset += local.length + filename.length + bytes.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

export function xmlEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export function run(text: string): string {
  return `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

export function paragraph(text: string, styleId?: string): string {
  return `<w:p>${styleId ? `<w:pPr><w:pStyle w:val="${xmlEscape(styleId)}"/></w:pPr>` : ""}${run(text)}</w:p>`;
}

export function documentXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`;
}

export function stylesXml(styles: string): string {
  return `<w:styles xmlns:w="${WORD_NS}">${styles}</w:styles>`;
}

export function style(id: string, name: string, properties = ""): string {
  return `<w:style w:type="paragraph" w:styleId="${xmlEscape(id)}"><w:name w:val="${xmlEscape(name)}"/>${properties}</w:style>`;
}

export function coreXml(title?: string, creator?: string): string {
  return `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">${title === undefined ? "" : `<dc:title>${xmlEscape(title)}</dc:title>`}${creator === undefined ? "" : `<dc:creator>${xmlEscape(creator)}</dc:creator>`}</cp:coreProperties>`;
}

export function encodeUtf16LeXml(xml: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]);
}

export interface DocxPackageOptions {
  body?: string;
  documentXml?: string | Buffer;
  styles?: string;
  core?: string | Buffer;
  documentPath?: string;
  documentTarget?: string;
  stylesPath?: string;
  stylesTarget?: string;
  corePath?: string;
  coreContentTypePath?: string;
  coreTarget?: string;
  relationships?: string;
  extraParts?: ZipEntry[];
  replaceParts?: ZipEntry[];
  omit?: string[];
}

export function buildDocxEntries(options: DocxPackageOptions = {}): ZipEntry[] {
  const mainPath = options.documentPath ?? "word/document.xml";
  const mainDirectory = mainPath.slice(0, mainPath.lastIndexOf("/") + 1);
  const mainBasename = mainPath.slice(mainPath.lastIndexOf("/") + 1);
  const corePath = options.corePath ?? "docProps/core.xml";
  const stylesPath = options.stylesPath ?? "word/styles.xml";
  const overrides = [
    `<Override PartName="/${xmlEscape(mainPath)}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`,
    ...(options.core
      ? [
          `<Override PartName="/${xmlEscape(options.coreContentTypePath ?? corePath)}" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
        ]
      : []),
  ];
  const packageRelationships = [
    `<Relationship Id="main" Type="${REL_NS}/officeDocument" Target="${xmlEscape(options.documentTarget ?? mainPath)}"/>`,
    ...(options.core
      ? [
          `<Relationship Id="core" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="${xmlEscape(options.coreTarget ?? corePath)}"/>`,
        ]
      : []),
  ];
  const documentRelationships = [
    ...(options.styles
      ? [
          `<Relationship Id="styles" Type="${REL_NS}/styles" Target="${xmlEscape(options.stylesTarget ?? (stylesPath.startsWith(mainDirectory) ? stylesPath.slice(mainDirectory.length) : `/${stylesPath}`))}"/>`,
        ]
      : []),
    options.relationships ?? "",
  ];
  const entries: ZipEntry[] = [
    [
      "[Content_Types].xml",
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${overrides.join("")}</Types>`,
    ],
    [
      "_rels/.rels",
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${packageRelationships.join("")}</Relationships>`,
    ],
    [mainPath, options.documentXml ?? documentXml(options.body ?? "")],
    [
      `${mainDirectory}_rels/${mainBasename}.rels`,
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${documentRelationships.join("")}</Relationships>`,
    ],
  ];
  if (options.styles) entries.push([stylesPath, options.styles]);
  if (options.core) entries.push([corePath, options.core]);
  entries.push(...(options.extraParts ?? []));
  const replacements = new Map(options.replaceParts ?? []);
  return entries
    .map(([name, content]): ZipEntry => [name, replacements.get(name) ?? content])
    .filter(([name]) => !options.omit?.includes(name));
}

export function buildDocxPackage(options: DocxPackageOptions = {}): Buffer {
  return buildStoredZip(buildDocxEntries(options));
}
