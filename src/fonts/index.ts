export { checkFontCoverage, NERD_FONT_SAMPLE_TEXT, sampleTextForLanguage } from "./coverage";
export { discoverSystemFonts, defaultFontDiscoveryRunner } from "./discovery";
export { fontconfigFontAdapter, parseFontconfigList } from "./adapters/fontconfig";
export { linuxFontAdapter } from "./adapters/linux";
export { macosFontAdapter, parseMacosSystemProfilerFonts } from "./adapters/macos";
export { windowsFontAdapter, parseWindowsFontRegistry } from "./adapters/windows";
export type {
  CheckFontCoverageInput,
  DiscoverFontsInput,
  DiscoverFontsResult,
  FontCodepointRange,
  FontCoverage,
  FontCoverageInventory,
  FontDiscoveryAdapter,
  FontDiscoveryAdapterInput,
  FontDiscoveryAdapterResult,
  FontDiscoveryCommandResult,
  FontDiscoveryCommandRunner,
  FontFace,
  FontFormat,
  FontSource,
  FontStyle,
} from "./types";
