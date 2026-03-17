import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = join(repoRoot, "test", "fixtures", "docs");
const FIXTURE_TIMESTAMP = new Date("2026-03-17T00:00:00.000Z");
const GENERATED_DOCX_FIXTURE_NAMES = [
  "hyperlink-heavy.docx",
  "metadata-rich.docx",
  "no-heading.docx",
  "table-heavy.docx",
  "weak-heading.docx",
];

function printUsage() {
  console.log(
    [
      "Create deterministic DOCX fixtures for rename/document extraction tests.",
      "",
      "Usage:",
      "  node scripts/generate-docx-fixtures.mjs seed [--output-dir <path>]",
      "  node scripts/generate-docx-fixtures.mjs clean [--output-dir <path>]",
      "  node scripts/generate-docx-fixtures.mjs reset [--output-dir <path>]",
      "",
      `Default output directory: ${defaultOutputDir}`,
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", outputDir: defaultOutputDir };
  }

  if (!["seed", "clean", "reset"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  let outputDir = defaultOutputDir;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--output-dir") {
      const raw = rest[index + 1];
      if (!raw) {
        throw new Error("Expected a path after --output-dir");
      }
      outputDir = resolve(repoRoot, raw);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, outputDir };
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let round = 0; round < 8; round += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { date, time } = toDosDateTime(FIXTURE_TIMESTAMP);

  for (const [fileName, rawContent] of entries) {
    const fileNameBuffer = Buffer.from(fileName, "utf8");
    const contentBuffer = Buffer.isBuffer(rawContent)
      ? rawContent
      : Buffer.from(rawContent, "utf8");
    const checksum = crc32(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuffer, contentBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileNameBuffer);
    offset += localHeader.length + fileNameBuffer.length + contentBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function buildDocumentParagraphs(paragraphs) {
  return paragraphs
    .map(({ styleId, text }) => {
      const styleXml = styleId ? `<w:pPr><w:pStyle w:val="${xmlEscape(styleId)}"/></w:pPr>` : "";
      return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
    })
    .join("");
}

function buildStylesXml(styleIds = []) {
  const uniqueStyleIds = [...new Set(styleIds)];
  const styles = [
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>',
  ];

  for (const styleId of uniqueStyleIds) {
    if (styleId === "Heading1") {
      styles.push(
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>',
      );
    } else if (styleId === "Heading2") {
      styles.push(
        '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>',
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${styles.join("")}</w:styles>`;
}

function buildCorePropertiesXml(metadata) {
  if (!metadata) {
    return undefined;
  }

  const created = metadata.created ?? "2026-03-17T00:00:00Z";
  const modified = metadata.modified ?? "2026-03-17T00:00:00Z";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${metadata.title ? `<dc:title>${xmlEscape(metadata.title)}</dc:title>` : ""}${metadata.creator ? `<dc:creator>${xmlEscape(metadata.creator)}</dc:creator>` : ""}${metadata.subject ? `<dc:subject>${xmlEscape(metadata.subject)}</dc:subject>` : ""}${metadata.description ? `<dc:description>${xmlEscape(metadata.description)}</dc:description>` : ""}${metadata.lastModifiedBy ? `<cp:lastModifiedBy>${xmlEscape(metadata.lastModifiedBy)}</cp:lastModifiedBy>` : ""}<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${modified}</dcterms:modified></cp:coreProperties>`;
}

function buildAppPropertiesXml(application = "Microsoft Office Word") {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>${xmlEscape(application)}</Application><AppVersion>16.0000</AppVersion></Properties>`;
}

function buildTableXml(rows) {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows
    .map(
      (row) =>
        `<w:tr>${row
          .map(
            (cell) =>
              `<w:tc><w:p><w:r><w:t xml:space="preserve">${xmlEscape(cell)}</w:t></w:r></w:p></w:tc>`,
          )
          .join("")}</w:tr>`,
    )
    .join("")}</w:tbl>`;
}

function buildHyperlinkParagraph(text, relationshipId) {
  return `<w:p><w:hyperlink r:id="${xmlEscape(relationshipId)}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:hyperlink></w:p>`;
}

function buildDocxFiles(options) {
  const coreXml = buildCorePropertiesXml(options.metadata);
  const appXml = options.includeAppProperties === false ? undefined : buildAppPropertiesXml(options.application);
  const paragraphStyles = options.paragraphs
    .map((paragraph) => paragraph.styleId)
    .filter(Boolean);
  const relationshipEntries = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
  ];
  if (coreXml) {
    relationshipEntries.push(
      '<Relationship Id="rId2" Type="unused-in-runtime" Target="docProps/core.xml"/>',
    );
  }
  if (appXml) {
    relationshipEntries.push(
      '<Relationship Id="rId3" Type="unused-in-runtime" Target="docProps/app.xml"/>',
    );
  }

  const overrideEntries = [
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>',
  ];
  if (coreXml) {
    overrideEntries.push(
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    );
  }
  if (appXml) {
    overrideEntries.push(
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    );
  }
  if (options.additionalOverrides) {
    overrideEntries.push(...options.additionalOverrides);
  }

  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrideEntries.join("")}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipEntries.join("")}</Relationships>`,
    ...(appXml ? { "docProps/app.xml": appXml } : {}),
    ...(coreXml ? { "docProps/core.xml": coreXml } : {}),
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${buildDocumentParagraphs(options.paragraphs)}${options.extraBodyXml ?? ""}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    "word/styles.xml": buildStylesXml(paragraphStyles),
    ...options.additionalFiles,
  };
}

function buildMetadataRichDocxFiles() {
  const title = "Quarterly Operating Plan 2026";
  return buildDocxFiles({
    metadata: {
      title,
      creator: "Fixture Generator",
      subject: "DOCX metadata extraction fixture",
      description: "Deterministic DOCX fixture with weak heading text and stronger metadata title.",
      lastModifiedBy: "Fixture Generator",
    },
    paragraphs: [
      { styleId: "Heading1", text: "Goal" },
      { text: title },
      { text: "This fixture exists to validate OOXML core metadata extraction and rename title ranking." },
      { text: "It intentionally combines a weak generic heading with a stronger metadata title." },
    ],
  });
}

function buildWeakHeadingDocxFiles() {
  return buildDocxFiles({
    paragraphs: [
      { styleId: "Heading1", text: "Goal" },
      { text: "Customer Launch Checklist" },
      { text: "Checklist for customer rollout, launch approvals, and communication handoff." },
    ],
  });
}

function buildNoHeadingDocxFiles() {
  return buildDocxFiles({
    paragraphs: [
      { text: "Q2 Hiring Plan" },
      { text: "Team staffing targets for engineering, design, and support over the next quarter." },
    ],
  });
}

function buildHyperlinkHeavyDocxFiles() {
  return buildDocxFiles({
    paragraphs: [
      { styleId: "Heading1", text: "Partner Reference Guide" },
      { text: "Collected links for pricing, onboarding, contracts, and support handoff." },
    ],
    extraBodyXml: `${buildHyperlinkParagraph("Pricing Portal", "rIdHyper1")}${buildHyperlinkParagraph("Onboarding Checklist", "rIdHyper2")}${buildHyperlinkParagraph("Support Escalation Guide", "rIdHyper3")}`,
    additionalFiles: {
      "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHyper1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/pricing" TargetMode="External"/><Relationship Id="rIdHyper2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/onboarding" TargetMode="External"/><Relationship Id="rIdHyper3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/support" TargetMode="External"/></Relationships>',
    },
  });
}

function buildTableHeavyDocxFiles() {
  return buildDocxFiles({
    paragraphs: [
      { styleId: "Heading1", text: "Roadmap Milestones" },
      { text: "Key delivery milestones grouped by stream and target month." },
    ],
    extraBodyXml: buildTableXml([
      ["Workstream", "Milestone", "Target"],
      ["Platform", "API stabilization", "April"],
      ["Growth", "Lifecycle messaging", "May"],
      ["Ops", "Runbook refresh", "June"],
    ]),
  });
}

function buildGeneratedDocxFixtures() {
  return {
    "hyperlink-heavy.docx": buildHyperlinkHeavyDocxFiles(),
    "metadata-rich.docx": buildMetadataRichDocxFiles(),
    "no-heading.docx": buildNoHeadingDocxFiles(),
    "table-heavy.docx": buildTableHeavyDocxFiles(),
    "weak-heading.docx": buildWeakHeadingDocxFiles(),
  };
}

async function ensureOutputDir(outputDir) {
  await mkdir(outputDir, { recursive: true });
}

async function writeDocxFixture(outputDir, fileName, files) {
  const zipBuffer = buildStoredZip(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(join(outputDir, fileName), zipBuffer);
}

async function seedFixtures(outputDir) {
  await ensureOutputDir(outputDir);
  const fixtures = buildGeneratedDocxFixtures();
  for (const [fileName, files] of Object.entries(fixtures)) {
    await writeDocxFixture(outputDir, fileName, files);
  }
}

async function cleanFixtures(outputDir) {
  for (const fileName of GENERATED_DOCX_FIXTURE_NAMES) {
    await rm(join(outputDir, fileName), { force: true });
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (parsed.command === "help") {
    printUsage();
    return;
  }

  if (parsed.command === "clean") {
    await cleanFixtures(parsed.outputDir);
    console.log(
      `Removed ${basename(join(parsed.outputDir, "metadata-rich.docx"))} from ${parsed.outputDir}`,
    );
    return;
  }

  if (parsed.command === "reset") {
    await cleanFixtures(parsed.outputDir);
    await seedFixtures(parsed.outputDir);
    console.log(`Reset deterministic DOCX fixtures in ${parsed.outputDir}`);
    return;
  }

  await seedFixtures(parsed.outputDir);
  console.log(`Seeded deterministic DOCX fixtures in ${parsed.outputDir}`);
}

await main();
