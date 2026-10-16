import { describe, expect, test } from "bun:test";

import { resolveDocxLimits } from "../../src/docx/limits";
import {
  minimalDocxEnvironment,
  remainingDeadline,
  rssExceeded,
} from "../../src/docx/runtime/policy";
import {
  RequestFrameDecoder,
  ResultFrameDecoder,
  encodeResultFrame,
  validateDocxReadResult,
} from "../../src/docx/runtime/protocol";
import type { DocxReadResult } from "../../src/docx/types";

const success: DocxReadResult = {
  ok: true,
  facts: {
    rawText: 'Independent "Unicode" report Ω\n\n',
    headings: [{ level: 2, text: "Independent report" }],
    hasContent: true,
    metadataResult: { metadata: { title: "Report" }, warnings: [] },
    diagnostics: [],
  },
};

// Fixture framing is written independently of the implementation's encoders.
function resultFrame(payload: Buffer, declared = payload.length): Buffer {
  const header = Buffer.alloc(12);
  header.write("CDXDRS01");
  header.writeUInt32BE(declared, 8);
  return Buffer.concat([header, payload]);
}

function requestFrame(metadata: Buffer, document: Buffer, declared = document.length): Buffer {
  const header = Buffer.alloc(16);
  header.write("CDXDRQ01");
  header.writeUInt32BE(metadata.length, 8);
  header.writeUInt32BE(declared, 12);
  return Buffer.concat([header, metadata, document]);
}

function decodeResult(bytes: Buffer, limits = resolveDocxLimits()): DocxReadResult {
  const decoder = new ResultFrameDecoder(limits);
  decoder.push(bytes);
  return decoder.finish();
}

describe("private DOCX byte transport", () => {
  test("receives arbitrary request fragmentation into a dedicated document allocation", () => {
    const limits = resolveDocxLimits();
    const document = Buffer.from([0x50, 0x4b, 0, 1, 0xff]);
    const decoder = new RequestFrameDecoder();
    const bytes = requestFrame(Buffer.from(JSON.stringify(limits)), document);
    for (const byte of bytes) decoder.push(Buffer.from([byte]));
    expect(decoder.complete).toBe(true);
    expect(decoder.finish().limits).toEqual(limits);
    expect(decoder.request.bytes).toEqual(document);
    expect(decoder.request.bytes.byteOffset).toBe(0);
    expect(decoder.request.bytes.buffer.byteLength).toBe(document.length);
    expect(() => decoder.push(Buffer.from([0]))).toThrow("docx_protocol_error");
  });

  test("rejects oversized request declarations before receiving their payload", () => {
    const declaredMetadata = Buffer.alloc(16);
    declaredMetadata.write("CDXDRQ01");
    declaredMetadata.writeUInt32BE(64 * 1024 + 1, 8);
    expect(() => new RequestFrameDecoder().push(declaredMetadata)).toThrow("docx_protocol_error");

    const limits = resolveDocxLimits({ compressedInputBytes: 3 });
    const tooLong = requestFrame(Buffer.from(JSON.stringify(limits)), Buffer.alloc(0), 4);
    expect(() => new RequestFrameDecoder().push(tooLong)).toThrow(
      "docx_limit:compressedInputBytes",
    );
    const tooMuchMetadata = requestFrame(
      Buffer.from(JSON.stringify({ ...limits, requestMetadataBytes: 1 })),
      Buffer.alloc(0),
    );
    expect(() => new RequestFrameDecoder().push(tooMuchMetadata)).toThrow(
      "docx_limit:requestMetadataBytes",
    );
  });

  test("requires one exact complete request and strict numeric metadata", () => {
    const limits = resolveDocxLimits();
    const ordinary = requestFrame(Buffer.from(JSON.stringify(limits)), Buffer.from("abc"));
    for (const bytes of [ordinary.subarray(0, 5), ordinary.subarray(0, ordinary.length - 1)]) {
      const decoder = new RequestFrameDecoder();
      decoder.push(bytes);
      expect(() => decoder.finish()).toThrow("docx_protocol_error");
    }
    expect(() => new RequestFrameDecoder().push(Buffer.concat([ordinary, ordinary]))).toThrow(
      "docx_protocol_error",
    );
    for (const metadata of [
      { ...limits, unknown: 1 },
      { ...limits, peakRssBytes: "256" },
      { ...limits, elapsedMilliseconds: 2 ** 31 },
      { ...limits, maxXmlDepth: null },
      { compressedInputBytes: 3 },
      null,
    ]) {
      expect(() =>
        new RequestFrameDecoder().push(
          requestFrame(Buffer.from(JSON.stringify(metadata)), Buffer.alloc(0)),
        ),
      ).toThrow("docx_protocol_error");
    }
  });

  test("validates request actual input boundaries after bounded metadata decode", () => {
    for (const compressedInputBytes of [2, 3, 4]) {
      const limits = resolveDocxLimits({ compressedInputBytes });
      const decoder = new RequestFrameDecoder();
      const bytes = requestFrame(Buffer.from(JSON.stringify(limits)), Buffer.from("abc"));
      if (compressedInputBytes < 3)
        expect(() => decoder.push(bytes)).toThrow("docx_limit:compressedInputBytes");
      else {
        decoder.push(bytes);
        expect(decoder.finish().bytes.toString()).toBe("abc");
      }
    }
  });

  test("counts metadata UTF-8 bytes below, equal to, and above its own cap", () => {
    const limits = resolveDocxLimits({ requestMetadataBytes: 512 });
    const json = JSON.stringify(limits);
    expect(Buffer.byteLength(json)).toBeLessThan(511);
    for (const size of [511, 512, 513]) {
      const metadata = Buffer.from(json + " ".repeat(size - Buffer.byteLength(json)));
      const decoder = new RequestFrameDecoder();
      const bytes = requestFrame(metadata, Buffer.from("abc"));
      if (size > 512) expect(() => decoder.push(bytes)).toThrow("docx_limit:requestMetadataBytes");
      else {
        decoder.push(bytes);
        expect(decoder.finish().bytes.toString()).toBe("abc");
      }
    }
  });

  test("receives fragmented result framing and uses encoded UTF-8 byte limits", () => {
    const payload = Buffer.from(JSON.stringify(success));
    const bytes = resultFrame(payload);
    for (const resultBytes of [payload.length - 1, payload.length, payload.length + 1]) {
      const limits = resolveDocxLimits({ resultBytes });
      const decoder = new ResultFrameDecoder(limits);
      if (resultBytes < payload.length) {
        expect(() => decoder.push(bytes.subarray(0, 12))).toThrow("docx_limit:resultBytes");
        expect(() => encodeResultFrame(success, limits)).toThrow("docx_limit:resultBytes");
      } else {
        for (const byte of bytes) decoder.push(Buffer.from([byte]));
        expect(decoder.finish()).toEqual(success);
        expect(encodeResultFrame(success, limits)).toEqual(bytes);
      }
    }
  });

  test("rejects malformed UTF-8, partial data, trailing bytes and second results", () => {
    const ordinary = resultFrame(Buffer.from(JSON.stringify(success)));
    for (const bytes of [
      Buffer.from("wrong-header"),
      ordinary.subarray(0, 8),
      ordinary.subarray(0, ordinary.length - 1),
      resultFrame(Buffer.from([0xc3, 0x28])),
      Buffer.concat([ordinary, Buffer.from([0])]),
      Buffer.concat([ordinary, ordinary]),
      resultFrame(Buffer.from("{}"), 0),
    ]) {
      expect(() => decodeResult(bytes)).toThrow("docx_protocol_error");
    }
  });

  test("rejects additional or ill-typed facts instead of accepting partial evidence", () => {
    if (!success.ok) throw new Error("Expected fixture facts");
    const invalid = [
      { ...success, extra: true },
      { ...success, facts: { ...success.facts, rawText: 3 } },
      { ...success, facts: { ...success.facts, hasContent: "yes" } },
      { ...success, facts: { ...success.facts, diagnostics: [1] } },
      { ...success, facts: { ...success.facts, headings: [{ level: 7, text: "Title" }] } },
      { ...success, facts: { ...success.facts, headings: [{ level: 1.5, text: "Title" }] } },
      {
        ...success,
        facts: { ...success.facts, headings: [{ level: 1, text: "Title", extra: 1 }] },
      },
      {
        ...success,
        facts: {
          ...success.facts,
          metadataResult: { warnings: [], metadata: { unsupported: "x" } },
        },
      },
      {
        ...success,
        facts: { ...success.facts, metadataResult: { reason: "docx_extract_error", warnings: [] } },
      },
      { ok: false, diagnostic: "raw exception text" },
      { ok: false, diagnostic: "docx_limit:unknown" },
    ];
    for (const value of invalid) {
      expect(() => validateDocxReadResult(value, resolveDocxLimits())).toThrow(
        "docx_protocol_error",
      );
      expect(() => decodeResult(resultFrame(Buffer.from(JSON.stringify(value))))).toThrow(
        "docx_protocol_error",
      );
    }
  });
});

describe("private DOCX runtime policy", () => {
  test("samples absolute child RSS with exact-boundary acceptance", () => {
    expect(rssExceeded(99, 100)).toBe(false);
    expect(rssExceeded(100, 100)).toBe(false);
    expect(rssExceeded(101, 100)).toBe(true);
    for (const invalid of [Number.NaN, Infinity, -1]) expect(rssExceeded(invalid, 100)).toBe(true);
  });

  test("deadline arithmetic has no negative extension", () => {
    expect(remainingDeadline(100, 99)).toBe(1);
    expect(remainingDeadline(100, 100)).toBe(0);
    expect(remainingDeadline(100, 101)).toBe(0);
  });

  test("child environment excludes loader flags, credentials, proxies and PATH", () => {
    const source = {
      NODE_OPTIONS: "--require arbitrary-loader",
      NODE_PATH: "arbitrary-modules",
      OPENAI_API_KEY: "synthetic-secret",
      HTTPS_PROXY: "http://example.invalid",
      PATH: "synthetic-path",
      HOME: "synthetic-home",
      TMPDIR: "synthetic-temp",
      TMP: "synthetic-temp-two",
      TEMP: "synthetic-temp-three",
      SystemRoot: "synthetic-system-root",
      FORCE_COLOR: "1",
      NO_COLOR: "0",
    };
    expect(minimalDocxEnvironment(source)).toEqual({
      NO_COLOR: "1",
      TMPDIR: "synthetic-temp",
      TMP: "synthetic-temp-two",
      TEMP: "synthetic-temp-three",
      SystemRoot: "synthetic-system-root",
    });
    expect(source.NO_COLOR).toBe("0");
  });
});
