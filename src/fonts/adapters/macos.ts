import { extname } from "node:path";

import type { FontDiscoveryAdapter, FontFace, FontFormat, FontStyle } from "../types";

interface MacosSystemProfilerFont {
  _name?: string;
  family?: string;
  type?: string;
  path?: string;
  style?: string;
}

function fontFormatFromProfiler(type: string | undefined, path: string | undefined): FontFormat {
  const source = `${type ?? ""} ${extname(path ?? "")}`.toLowerCase();
  if (source.includes("truetype") || source.includes(".ttf")) {
    return "ttf";
  }
  if (source.includes("opentype") || source.includes(".otf")) {
    return "otf";
  }
  if (source.includes(".ttc")) {
    return "ttc";
  }
  if (source.includes(".woff2")) {
    return "woff2";
  }
  if (source.includes(".woff")) {
    return "woff";
  }
  return "unknown";
}

function fontStyleFromText(value: string | undefined): FontStyle {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("oblique")) {
    return "oblique";
  }
  if (normalized.includes("italic")) {
    return "italic";
  }
  return "normal";
}

export function parseMacosSystemProfilerFonts(stdout: string): FontFace[] {
  const parsed = JSON.parse(stdout) as { SPFontsDataType?: MacosSystemProfilerFont[] };
  return (parsed.SPFontsDataType ?? [])
    .map((font) => {
      const fullName = font._name?.trim() ?? "";
      const family = font.family?.trim() || fullName;
      if (!family) {
        return null;
      }
      return {
        family,
        fullName: fullName || family,
        style: fontStyleFromText(font.style ?? fullName),
        path: font.path,
        format: fontFormatFromProfiler(font.type, font.path),
        source: "system",
      } satisfies FontFace;
    })
    .filter((font): font is FontFace => font !== null);
}

export const macosFontAdapter: FontDiscoveryAdapter = {
  name: "macos-system-profiler",
  async discover({ runner }) {
    const result = await runner("system_profiler", ["SPFontsDataType", "-json"]);
    if (!result.ok) {
      return {
        faces: [],
        warnings: [result.stderr.trim() || "macOS font discovery failed."],
      };
    }
    try {
      return {
        faces: parseMacosSystemProfilerFonts(result.stdout),
        warnings: [],
      };
    } catch (error) {
      return {
        faces: [],
        warnings: [error instanceof Error ? error.message : "Failed to parse macOS fonts."],
      };
    }
  },
};
