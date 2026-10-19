import { expect, test } from "bun:test";

import { readDocxDocument } from "../../src/docx/reader";
import { buildDocxPackage } from "./fixtures/docx-baseline/corpus/builder";
import { createDocxDrawingCases } from "./fixtures/docx-drawing-cases";
import { createDocxFallbackCases } from "./fixtures/docx-fallback-cases";

for (const item of [...createDocxDrawingCases(), ...createDocxFallbackCases()]) {
  test(item.id, async () => {
    const result = await readDocxDocument(buildDocxPackage(item.options));
    if (item.diagnostic) {
      expect(result).toEqual({ ok: false, diagnostic: item.diagnostic });
      return;
    }
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) throw new Error(result.diagnostic);
    expect(result.facts.rawText).toBe(item.rawText!);
    expect(result.facts.headings).toEqual(item.headings!);
    expect(result.facts.hasContent).toBe(true);
  });
}
