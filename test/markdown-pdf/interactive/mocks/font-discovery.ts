import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../../../cli-foundations/interactive-harness/context";
import { fontDiscoveryModuleUrl } from "../module-urls";

export function installMarkdownPdfFontDiscoveryMock(context: HarnessRunnerContext): void {
  mock.module(fontDiscoveryModuleUrl, () => ({
    defaultFontDiscoveryRunner: async () => {
      throw new Error("Unexpected direct font discovery in the Interactive harness");
    },
    discoverSystemFonts: async (input: Record<string, unknown>) => {
      const discoveryIndex = context.result.markdownPdfFontDiscoveryCalls.length;
      context.result.markdownPdfFontDiscoveryCalls.push({
        discovery: input.discovery,
        hasSignal: input.signal instanceof AbortSignal,
        timeoutMs: input.timeoutMs,
      });
      if (context.scenario.markdownPdfFontDiscoveryErrorMessage) {
        throw new Error(context.scenario.markdownPdfFontDiscoveryErrorMessage);
      }
      const families =
        context.scenario.markdownPdfFontFamilyRuns?.[discoveryIndex] ??
        context.scenario.markdownPdfFontFamilies ??
        [];
      return {
        adapter: "fontconfig",
        discovery: "fontconfig",
        faces: families.map((family, index) => ({
          family,
          fullName: family,
          path: `/private/font-${index}.otf`,
          source: "system",
          style: "normal",
        })),
        warnings: [],
      };
    },
  }));
}
