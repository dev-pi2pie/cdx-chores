import { extname } from "node:path";

import type { FontDiscoveryAdapter, FontFace, FontFormat, FontStyle } from "../types";

function fontFormatFromPath(path: string | undefined): FontFormat {
  const extension = extname(path ?? "").toLowerCase();
  if (extension === ".ttf") {
    return "ttf";
  }
  if (extension === ".otf") {
    return "otf";
  }
  if (extension === ".ttc") {
    return "ttc";
  }
  if (extension === ".woff") {
    return "woff";
  }
  if (extension === ".woff2") {
    return "woff2";
  }
  return "unknown";
}

function fontStyleFromText(value: string): FontStyle {
  const normalized = value.toLowerCase();
  if (normalized.includes("oblique")) {
    return "oblique";
  }
  if (normalized.includes("italic")) {
    return "italic";
  }
  return "normal";
}

function fontWeightFromText(value: string): number | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes("thin")) {
    return 100;
  }
  if (normalized.includes("extralight") || normalized.includes("ultralight")) {
    return 200;
  }
  if (normalized.includes("light")) {
    return 300;
  }
  if (normalized.includes("medium")) {
    return 500;
  }
  if (normalized.includes("semibold") || normalized.includes("demibold")) {
    return 600;
  }
  if (normalized.includes("bold")) {
    return 700;
  }
  if (normalized.includes("black") || normalized.includes("heavy")) {
    return 900;
  }
  return undefined;
}

function firstFontFamily(value: string): string {
  return (
    value
      .split(",")
      .map((part) => part.trim())
      .find(Boolean) ?? ""
  );
}

export function parseFontconfigList(stdout: string): FontFace[] {
  const faces: FontFace[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const [rawFamily, rawFullName, rawStyle, rawPath] = line.split("\t");
    const family = firstFontFamily(rawFamily ?? "");
    if (!family) {
      continue;
    }
    const styleText = rawStyle?.trim() ?? "";
    const path = rawPath?.trim() || undefined;
    faces.push({
      family,
      fullName: rawFullName?.trim() || family,
      style: fontStyleFromText(styleText),
      weight: fontWeightFromText(styleText),
      path,
      format: fontFormatFromPath(path),
      source: "system",
    });
  }
  return faces;
}

export const fontconfigFontAdapter: FontDiscoveryAdapter = {
  name: "fontconfig",
  async discover({ runner }) {
    const result = await runner("fc-list", [
      "--format",
      "%{family}\t%{fullname}\t%{style}\t%{file}\n",
    ]);
    if (!result.ok) {
      return {
        faces: [],
        warnings: [result.stderr.trim() || "fontconfig discovery failed."],
      };
    }
    return {
      faces: parseFontconfigList(result.stdout),
      warnings: [],
    };
  },
};
