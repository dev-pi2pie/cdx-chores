import { TextDecoder } from "node:util";

import { checkDocxLimit, DEFAULT_DOCX_LIMITS, resolveDocxLimits, type DocxLimits } from "../limits";
import type { DocxReadResult } from "../types";

const requestMagic = Buffer.from("CDXDRQ01", "ascii");
const resultMagic = Buffer.from("CDXDRS01", "ascii");
const metadataCeiling = 64 * 1024;
const utf8 = new TextDecoder("utf8", { fatal: true });
const metadataKeys = new Set([
  "title",
  "creator",
  "subject",
  "description",
  "lastModifiedBy",
  "created",
  "modified",
  "application",
]);
const failureCodes = new Set([
  "docx_extract_error",
  "docx_main_document_unavailable",
  "docx_xml_invalid",
  "docx_xml_unsupported",
  "docx_xml_declaration_unsupported",
  "docx_style_map_unsupported",
  "docx_symbol_font_missing",
  "docx_note_missing",
  "docx_comment_missing",
  "docx_initial_reader_error",
  "docx_supervisor_busy",
  "docx_cancelled",
  "docx_limits_invalid",
  "docx_startup_error",
  "docx_input_error",
  "docx_protocol_error",
  "docx_child_exit",
  "docx_worker_error",
  "docx_cleanup_unconfirmed",
  "docx_offline_guard_failed",
]);

function invalid(): never {
  throw new Error("docx_protocol_error");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): void {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))
  )
    invalid();
}

function string(value: unknown, limits: DocxLimits): value is string {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= limits.resultBytes;
}

function strings(value: unknown, limits: DocxLimits): boolean {
  return (
    Array.isArray(value) &&
    value.length <= limits.resultBytes &&
    value.every((entry) => string(entry, limits))
  );
}

/** Exact facts schema is checked in both processes; bytes are bounded before decoding. */
export function validateDocxReadResult(value: unknown, limits: DocxLimits): DocxReadResult {
  if (!record(value)) invalid();
  if (value.ok === false) {
    exactKeys(value, ["ok", "diagnostic"]);
    if (
      typeof value.diagnostic !== "string" ||
      (!failureCodes.has(value.diagnostic) &&
        !Object.keys(DEFAULT_DOCX_LIMITS).some((key) => value.diagnostic === `docx_limit:${key}`))
    )
      invalid();
    return value as unknown as DocxReadResult;
  }
  if (value.ok !== true) invalid();
  exactKeys(value, ["ok", "facts"]);
  if (!record(value.facts)) invalid();
  const facts = value.facts;
  exactKeys(facts, ["headings", "rawText", "hasContent", "metadataResult", "diagnostics"]);
  if (
    !string(facts.rawText, limits) ||
    typeof facts.hasContent !== "boolean" ||
    !strings(facts.diagnostics, limits) ||
    !Array.isArray(facts.headings) ||
    facts.headings.length > limits.resultBytes
  )
    invalid();
  for (const heading of facts.headings) {
    if (!record(heading)) invalid();
    exactKeys(heading, ["level", "text"]);
    if (
      !Number.isInteger(heading.level) ||
      (heading.level as number) < 1 ||
      (heading.level as number) > 6 ||
      !string(heading.text, limits)
    )
      invalid();
  }
  const metadata = facts.metadataResult;
  if (!record(metadata)) invalid();
  if (Object.hasOwn(metadata, "reason")) {
    exactKeys(metadata, ["reason"]);
    if (metadata.reason !== "docx_extract_error") invalid();
  } else {
    exactKeys(metadata, ["warnings"], ["metadata"]);
    if (!strings(metadata.warnings, limits)) invalid();
    if (Object.hasOwn(metadata, "metadata")) {
      if (!record(metadata.metadata)) invalid();
      for (const [key, entry] of Object.entries(metadata.metadata)) {
        if (!metadataKeys.has(key) || !string(entry, limits)) invalid();
      }
    }
  }
  return value as unknown as DocxReadResult;
}

function json(bytes: Buffer): unknown {
  try {
    return JSON.parse(utf8.decode(bytes));
  } catch {
    return invalid();
  }
}

export function encodeRequestHeader(metadataBytes: number, documentBytes: number): Buffer {
  if (
    !Number.isInteger(metadataBytes) ||
    metadataBytes < 0 ||
    metadataBytes > 0xffff_ffff ||
    !Number.isInteger(documentBytes) ||
    documentBytes < 0 ||
    documentBytes > 0xffff_ffff
  )
    invalid();
  const header = Buffer.alloc(16);
  requestMagic.copy(header);
  header.writeUInt32BE(metadataBytes, 8);
  header.writeUInt32BE(documentBytes, 12);
  return header;
}

export function encodeResultFrame(result: DocxReadResult, limits: DocxLimits): Buffer {
  const payload = Buffer.from(JSON.stringify(result), "utf8");
  checkDocxLimit(payload.byteLength, "resultBytes", limits);
  validateDocxReadResult(json(payload), limits);
  if (payload.byteLength > 0xffff_ffff) invalid();
  const header = Buffer.alloc(12);
  resultMagic.copy(header);
  header.writeUInt32BE(payload.byteLength, 8);
  return Buffer.concat([header, payload], header.byteLength + payload.byteLength);
}

/** Optional undefined fields disappear on the wire; incoming frames remain strict. */
export function canonicalizeDocxReadResult(
  result: DocxReadResult,
  limits: DocxLimits,
): DocxReadResult {
  const frame = encodeResultFrame(result, limits);
  return validateDocxReadResult(json(frame.subarray(12)), limits);
}

export class RequestFrameDecoder {
  private header = Buffer.alloc(16);
  private headerOffset = 0;
  private metadata: Buffer | undefined;
  private metadataOffset = 0;
  private document: Buffer | undefined;
  private documentOffset = 0;
  private documentLength = 0;
  private limits: DocxLimits | undefined;

  get complete(): boolean {
    return this.document !== undefined && this.documentOffset === this.documentLength;
  }

  get request(): { limits: DocxLimits; bytes: Buffer } {
    if (!this.complete || !this.limits || !this.document) invalid();
    return { limits: this.limits, bytes: this.document };
  }

  push(chunk: Buffer): void {
    let position = 0;
    while (position < chunk.byteLength) {
      if (this.complete) invalid();
      if (this.headerOffset < this.header.byteLength) {
        const count = Math.min(
          this.header.byteLength - this.headerOffset,
          chunk.byteLength - position,
        );
        chunk.copy(this.header, this.headerOffset, position, position + count);
        this.headerOffset += count;
        position += count;
        if (this.headerOffset !== this.header.byteLength) continue;
        if (!this.header.subarray(0, 8).equals(requestMagic)) invalid();
        const metadataLength = this.header.readUInt32BE(8);
        if (metadataLength === 0 || metadataLength > metadataCeiling) invalid();
        this.metadata = Buffer.alloc(metadataLength);
        this.documentLength = this.header.readUInt32BE(12);
      }
      if (this.metadata && this.metadataOffset < this.metadata.byteLength) {
        const count = Math.min(
          this.metadata.byteLength - this.metadataOffset,
          chunk.byteLength - position,
        );
        chunk.copy(this.metadata, this.metadataOffset, position, position + count);
        this.metadataOffset += count;
        position += count;
        if (this.metadataOffset !== this.metadata.byteLength) continue;
        const decoded = json(this.metadata);
        if (!record(decoded)) invalid();
        exactKeys(decoded, Object.keys(DEFAULT_DOCX_LIMITS));
        try {
          this.limits = resolveDocxLimits(decoded as DocxLimits);
        } catch {
          invalid();
        }
        checkDocxLimit(this.metadata.byteLength, "requestMetadataBytes", this.limits);
        checkDocxLimit(this.documentLength, "compressedInputBytes", this.limits);
        // A dedicated backing allocation can be transferred without unrelated pooled bytes.
        this.document = Buffer.from(new ArrayBuffer(this.documentLength));
      }
      if (this.document) {
        const count = Math.min(
          this.documentLength - this.documentOffset,
          chunk.byteLength - position,
        );
        chunk.copy(this.document, this.documentOffset, position, position + count);
        this.documentOffset += count;
        position += count;
      }
    }
  }

  finish(): { limits: DocxLimits; bytes: Buffer } {
    return this.request;
  }
}

export class ResultFrameDecoder {
  private header = Buffer.alloc(12);
  private headerOffset = 0;
  private payload: Buffer | undefined;
  private payloadOffset = 0;

  constructor(private readonly limits: DocxLimits) {}

  push(chunk: Buffer): void {
    let position = 0;
    while (position < chunk.byteLength) {
      if (this.payload && this.payloadOffset === this.payload.byteLength) invalid();
      if (this.headerOffset < this.header.byteLength) {
        const count = Math.min(
          this.header.byteLength - this.headerOffset,
          chunk.byteLength - position,
        );
        chunk.copy(this.header, this.headerOffset, position, position + count);
        this.headerOffset += count;
        position += count;
        if (this.headerOffset !== this.header.byteLength) continue;
        if (!this.header.subarray(0, 8).equals(resultMagic)) invalid();
        const length = this.header.readUInt32BE(8);
        if (length === 0) invalid();
        checkDocxLimit(length, "resultBytes", this.limits);
        this.payload = Buffer.alloc(length);
      }
      if (this.payload) {
        const count = Math.min(
          this.payload.byteLength - this.payloadOffset,
          chunk.byteLength - position,
        );
        chunk.copy(this.payload, this.payloadOffset, position, position + count);
        this.payloadOffset += count;
        position += count;
      }
    }
  }

  finish(): DocxReadResult {
    if (!this.payload || this.payloadOffset !== this.payload.byteLength) invalid();
    return validateDocxReadResult(json(this.payload), this.limits);
  }
}
