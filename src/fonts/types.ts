export type FontSource = "system" | "bundled" | "custom";

export type FontFormat = "ttf" | "otf" | "ttc" | "woff" | "woff2" | "unknown";

export type FontStyle = "normal" | "italic" | "oblique";

export interface FontFace {
  family: string;
  fullName: string;
  style: FontStyle;
  weight?: number;
  path?: string;
  format?: FontFormat;
  source: FontSource;
}

export interface FontDiscoveryCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export type FontDiscoveryCommandRunner = (
  command: string,
  args: string[],
) => Promise<FontDiscoveryCommandResult>;

export interface FontDiscoveryAdapterInput {
  runner: FontDiscoveryCommandRunner;
}

export interface FontDiscoveryAdapterResult {
  faces: FontFace[];
  warnings: string[];
  adapterName?: string;
}

export interface FontDiscoveryAdapter {
  name: string;
  discover(input: FontDiscoveryAdapterInput): Promise<FontDiscoveryAdapterResult>;
}

export const FONT_DISCOVERY_MODES = ["auto", "native", "fontconfig"] as const;

export type FontDiscoveryMode = (typeof FONT_DISCOVERY_MODES)[number];

export type FontDiscoverySelectionReason = "macos-auto-fontconfig" | "macos-auto-native-fallback";

export interface FontDiscoveryAttempt {
  adapter: string;
  command: string;
  status: "success" | "failed";
  durationMs: number;
  message: string;
}

export interface DiscoverFontsInput {
  platform?: NodeJS.Platform;
  runner?: FontDiscoveryCommandRunner;
  discovery?: FontDiscoveryMode;
  includeAttempts?: boolean;
}

export interface DiscoverFontsResult {
  faces: FontFace[];
  warnings: string[];
  adapter: string;
  discovery: FontDiscoveryMode;
  selectionReason?: FontDiscoverySelectionReason;
  attempts?: FontDiscoveryAttempt[];
}

export interface FontCodepointRange {
  name: string;
  start: number;
  end: number;
}

export interface FontCoverageInventory {
  family: string;
  supportedCodepoints?: number[];
  supportedRanges?: FontCodepointRange[];
  nerdFont?: boolean;
}

export interface CheckFontCoverageInput {
  family: string;
  text: string;
  inventory?: FontCoverageInventory;
  requireNerdFont?: boolean;
}

export interface FontCoverage {
  family: string;
  status: "known" | "unknown";
  supportsText: boolean;
  missingCodepoints: string[];
  scripts: string[];
  nerdFont: {
    detected: boolean;
    matchedRanges: string[];
  };
}
