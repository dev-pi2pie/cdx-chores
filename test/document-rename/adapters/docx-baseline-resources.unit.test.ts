import { describe, expect, test } from "bun:test";

import {
  buildStoredZip,
  encodeUtf16LeXml,
  style,
  stylesXml,
} from "../../../scripts/docx-baseline/corpus/builder.ts";
import {
  createResourceCases,
  RESOURCE_BOUNDARIES,
} from "../../../scripts/docx-baseline/resource-cases.ts";
import {
  countXmlForInspection,
  DOCX_INSPECTION_LIMITS,
  inspectDocxResources,
} from "../../../scripts/docx-baseline/resources.ts";

describe("DOCX baseline resource instrumentation", () => {
  test("retains duplicate raw entries, actual byte counts, and XML shape", async () => {
    const xml = '<root value=">"><!--<ignored/>--><![CDATA[<ignored/>]]><child/></root>';
    const metrics = await inspectDocxResources(
      buildStoredZip([
        ["same.xml", xml],
        ["same.xml", "<other/>"],
        ["folder/", ""],
      ]),
    );
    expect(metrics.status).toBe("complete");
    expect(metrics.entryCount).toBe(3);
    expect(metrics.parts.map((part) => part.name)).toEqual(["same.xml", "same.xml", "folder/"]);
    expect(metrics.parts[0]?.xml).toEqual({ validation: "valid", elementCount: 2, maxDepth: 2 });
    expect(metrics.xmlElementCount).toBe(3);
    expect(metrics.declaredUncompressedBytes).toBe(Buffer.byteLength(xml) + 8);
    expect(metrics.totalDecompressedBytes).toBe(metrics.declaredUncompressedBytes);
    expect(metrics.cleanup).toEqual({
      zipClose: "closed",
      streamsOpened: 2,
      streamsCompleted: 2,
      streamsDestroyedEarly: 0,
      streamsClosed: 2,
      activeStreams: 0,
    });
  });

  test("counts UTF-16 XML and measures cycles without following repeated IDs", async () => {
    const metrics = await inspectDocxResources(
      buildStoredZip([
        ["part.xml", encodeUtf16LeXml("<root><child/></root>")],
        [
          "styles.xml",
          stylesXml(
            `${style("A", "A", '<w:basedOn w:val="B"/>')}${style("B", "B", '<w:basedOn w:val="A"/>')}`,
          ),
        ],
      ]),
    );
    expect(metrics.status).toBe("complete");
    expect(metrics.parts[0]?.xml).toEqual({ validation: "valid", elementCount: 2, maxDepth: 2 });
    expect(metrics.styleDefinitionCount).toBe(2);
    expect(metrics.maxStyleTraversalSteps).toBe(2);
    expect(metrics.totalStyleTraversalSteps).toBe(4);
    expect(metrics.styleTraversalsEndingInCycle).toBe(2);
  });

  test("marks malformed XML and declines DTD interpretation without expanding entities", async () => {
    const metrics = await inspectDocxResources(
      buildStoredZip([
        ["malformed.xml", "<root><child></root>"],
        ["entities.xml", '<!DOCTYPE root [<!ENTITY boom "text">]><root>&boom;</root>'],
      ]),
    );
    expect(metrics.status).toBe("complete");
    expect(metrics.parts[0]?.xml?.validation).toBe("invalid");
    expect(metrics.parts[1]?.xml?.validation).toBe("doctype-not-inspected");
    expect(metrics.cleanup.activeStreams).toBe(0);
    expect(metrics.cleanup.zipClose).toBe("closed");
  });

  test("scans unterminated markup without revisiting the same suffix", () => {
    expect(countXmlForInspection("<".repeat(256 * 1024))).toEqual({
      elementCount: 0,
      maxDepth: 0,
    });
  });

  test("closes an opened ZIP when opening an unsupported-compression entry fails", async () => {
    const zip = buildStoredZip([["unsupported.bin", "value"]]);
    const centralOffset = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt16LE(99, 8);
    zip.writeUInt16LE(99, centralOffset + 10);
    const metrics = await inspectDocxResources(zip);
    expect(metrics.status).toBe("error");
    expect(metrics.parts[0]?.readOutcome).toBe("error");
    expect(metrics.cleanup.zipClose).toBe("closed");
    expect(metrics.cleanup.activeStreams).toBe(0);
  });

  test("destroys an active stream at the inspector byte ceiling and remains repeatable", async () => {
    const zip = buildStoredZip([
      ["large.bin", Buffer.alloc(DOCX_INSPECTION_LIMITS.maxPartDecompressedBytes + 1)],
    ]);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const metrics = await inspectDocxResources(zip);
      expect(metrics.status).toBe("limit");
      expect(metrics.limit).toBe("maxPartDecompressedBytes");
      expect(metrics.totalDecompressedBytes).toBeGreaterThan(
        DOCX_INSPECTION_LIMITS.maxPartDecompressedBytes,
      );
      expect(metrics.parts[0]?.readOutcome).toBe("limit");
      expect(metrics.cleanup.streamsDestroyedEarly).toBe(1);
      expect(metrics.cleanup.streamsCompleted).toBe(0);
      expect(metrics.cleanup.streamsClosed).toBe(1);
      expect(metrics.cleanup.activeStreams).toBe(0);
      expect(metrics.cleanup.zipClose).toBe("closed");
    }
  });

  test("reports an invalid ZIP without claiming to close an unopened archive", async () => {
    const metrics = await inspectDocxResources(Buffer.from("not a ZIP"));
    expect(metrics.status).toBe("error");
    expect(metrics.cleanup.zipClose).toBe("not-opened");
    expect(metrics.cleanup.streamsOpened).toBe(0);
  });

  test("constructs exact below, at, and above dimensions for every structural proposal", async () => {
    const cases = createResourceCases();
    expect(cases).toHaveLength(21);
    for (const boundary of RESOURCE_BOUNDARIES) {
      const testCase = cases.find((item) => item.id === boundary.caseId)!;
      if (!("bytes" in testCase.input)) throw new Error("Expected generated resource case");
      const metrics = await inspectDocxResources(testCase.input.bytes);
      expect(metrics.status).toBe("complete");
      const measured =
        boundary.metric === "maxPartDecompressedBytes"
          ? Math.max(...metrics.parts.map((part) => part.actualDecompressedBytes))
          : metrics[boundary.metric];
      expect({ caseId: boundary.caseId, measured }).toEqual({
        caseId: boundary.caseId,
        measured: boundary.measuredTarget,
      });
      expect(metrics.cleanup.activeStreams).toBe(0);
      expect(metrics.cleanup.streamsOpened).toBe(metrics.cleanup.streamsCompleted);
      expect(metrics.cleanup.streamsOpened).toBe(metrics.cleanup.streamsClosed);
      expect(metrics.cleanup.zipClose).toBe("closed");
    }
  });
});
